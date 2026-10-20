/* ═══════════════════════════════════════════════════════════════
   NEURO LAB — api/relatorio.js
   Handler do endpoint POST /api/relatorio
   Sessao 3B: integracao com a API da Anthropic

   FLUXO:
   1. Valida o payload recebido do index.html
   2. Tenta gerar conteudo via Anthropic API
   3. Se falhar por qualquer motivo → usa fallback.json automaticamente
   4. Grava a sessao em data/sessions.json
   5. Retorna URL do relatorio + conteudo gerado

   SEGURANCA:
   - ANTHROPIC_API_KEY so existe em variaveis de ambiente (.env)
   - A chave nunca e enviada ao navegador nem aparece em logs
   - Timeout de 8s impede travamento na feira
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { lerSessoes } = require('./sessoes');

// ── ANTHROPIC SDK ─────────────────────────────────────────────
// Carregado condicionalmente: se o pacote nao estiver instalado
// ou a chave ausente, o sistema cai no fallback silenciosamente.
let Anthropic = null;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (_) {
  // Pacote nao instalado — modo fallback permanente
}

// ── CONFIGURACAO ──────────────────────────────────────────────
const FALLBACK_PATH   = path.join(__dirname, 'fallback.json');
const SESSIONS_PATH   = path.join(__dirname, '..', 'data', 'sessions.json');
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY  || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL    || 'claude-haiku-4-5';
const TIMEOUT_MS      = 8000; // 8s — se passar disso, usa fallback

// ── CARREGAR FALLBACK ─────────────────────────────────────────
// Carregado uma vez ao iniciar o modulo, nao a cada requisicao
let fallback = {};
try {
  fallback = JSON.parse(fs.readFileSync(FALLBACK_PATH, 'utf8'));
} catch (err) {
  console.error('[relatorio] ERRO ao carregar fallback.json:', err.message);
}

// ── INSTANCIA DO CLIENTE ANTHROPIC ───────────────────────────
// Criada uma vez, reutilizada em todas as requisicoes
let anthropicClient = null;
if (Anthropic && ANTHROPIC_KEY) {
  try {
    anthropicClient = new Anthropic.default({ apiKey: ANTHROPIC_KEY });
    console.log('[relatorio] Anthropic API: ATIVA (modelo: ' + ANTHROPIC_MODEL + ')');
  } catch (err) {
    console.warn('[relatorio] Falha ao instanciar cliente Anthropic:', err.message);
    console.warn('[relatorio] Usando fallback offline.');
  }
} else if (!ANTHROPIC_KEY) {
  console.warn('[relatorio] ANTHROPIC_API_KEY nao definida — usando fallback offline.');
} else {
  console.warn('[relatorio] @anthropic-ai/sdk nao instalado — usando fallback offline.');
}

/* ════════════════════════════════════════════════════════════════
   HANDLER PRINCIPAL
   ════════════════════════════════════════════════════════════════ */

/**
 * POST /api/relatorio
 *
 * Payload esperado:
 * {
 *   "emotions": [
 *     { "name": "Curioso", "pct": 74, "key": "happy" },
 *     { "name": "Atento",  "pct": 68, "key": "neutral" },
 *     { "name": "Calmo",   "pct": 52, "key": "neutral" }
 *   ],
 *   "dominant": "happy"
 * }
 */
async function handleRelatorio(req, res) {
  // Express 4 não captura erros de handlers async: sem este try/catch,
  // qualquer exceção inesperada deixaria a requisição pendurada.
  try {
    return await processarRelatorio(req, res);
  } catch (err) {
    console.error('[relatorio] Erro inesperado:', err);
    if (!res.headersSent) res.status(500).json({ ok: false, erro: 'Erro interno ao gerar relatório' });
  }
}

async function processarRelatorio(req, res) {
  const startTime = Date.now();

  // ── 1. VALIDACAO DO PAYLOAD ────────────────────────────────
  const { emotions, dominant } = req.body || {};

  if (!emotions || !Array.isArray(emotions) || emotions.length === 0) {
    return res.status(400).json({
      ok  : false,
      erro: 'Payload invalido: campo "emotions" ausente ou vazio.',
      dica: 'Envie { emotions: [...], dominant: "..." }',
    });
  }

  for (const emocao of emotions) {
    if (!emocao || typeof emocao !== 'object' ||
        typeof emocao.name !== 'string' ||
        typeof emocao.pct  !== 'number' ||
        typeof emocao.key  !== 'string') {
      return res.status(400).json({
        ok  : false,
        erro: 'Cada emocao deve ter { name: string, pct: number, key: string }',
      });
    }
  }

  const emotionKey = (typeof dominant === 'string' && dominant.trim())
    ? dominant.trim()
    : emotions[0]?.key || 'neutral';

  // ── 2. GERAR CONTEUDO (Anthropic → fallback) ──────────────
  let conteudo;
  let fonte = 'fallback';

  try {
    if (anthropicClient) {
      conteudo = await getAnthropicContent(emotions, emotionKey);
      fonte    = 'anthropic';
    } else {
      conteudo = getFallbackContent(emotionKey);
    }
  } catch (err) {
    // Qualquer falha da Anthropic (rede, timeout, auth, parse)
    // aciona o fallback sem interromper a experiencia
    console.warn('[relatorio] Anthropic falhou, usando fallback:', err.message);
    conteudo = getFallbackContent(emotionKey);
    fonte    = 'fallback';
  }

  // ── 3. MONTAR E GRAVAR A SESSAO ───────────────────────────
  const sessionId = uuidv4();
  const sessao    = {
    id        : sessionId,
    timestamp : new Date().toISOString(),
    dominant  : emotionKey,
    emotions  : emotions.slice(0, 3),
    abertura  : conteudo.abertura,
    dicas     : conteudo.dicas,
    fonte,
    duracao_ms: Date.now() - startTime,
  };

  try {
    gravarSessao(sessao);
  } catch (err) {
    console.error('[relatorio] AVISO: falha ao gravar sessao:', err.message);
    // Nao interrompe a resposta — conteudo gerado e entregue mesmo sem persistencia
  }

  // ── 4. LOG ────────────────────────────────────────────────
  const top3 = emotions
    .slice(0, 3)
    .map(e => e.name + '(' + e.pct + '%)')
    .join(' . ');

  console.log(
    '[relatorio] OK Sessao ' + sessionId.slice(0, 8) +
    ' | ' + top3 +
    ' | fonte: ' + fonte +
    ' | ' + (Date.now() - startTime) + 'ms'
  );

  // ── 5. RESPOSTA ───────────────────────────────────────────
  // urlCompleta vai no QR: usa o endereço de rede definido no server.js,
  // não o host do navegador (o HUD roda em localhost).
  const urlRelativa = '/relatorio/' + sessionId;
  const getUrlPublica = req.app && req.app.locals.getUrlPublica;
  return res.status(200).json({
    ok         : true,
    sessionId,
    url        : urlRelativa,
    urlCompleta: getUrlPublica ? getUrlPublica() + urlRelativa : null,
    abertura : conteudo.abertura,
    dicas    : conteudo.dicas,
    fonte,
  });
}

/* ════════════════════════════════════════════════════════════════
   GERACAO DE CONTEUDO VIA ANTHROPIC
   ════════════════════════════════════════════════════════════════ */

/**
 * Chama a API da Anthropic e retorna { abertura, dicas }.
 * Lanca excecao em qualquer falha — o caller trata e usa fallback.
 *
 * @param  {Array}  emotions   - array de emocoes detectadas
 * @param  {string} emotionKey - chave da emocao dominante
 * @returns {{ abertura: string, dicas: string[] }}
 */
async function getAnthropicContent(emotions, emotionKey) {
  // Mapeia chaves do Face-api para nomes em portugues
  const NOMES_PT = {
    happy    : 'alegria',
    neutral  : 'tranquilidade',
    surprised: 'surpresa',
    sad      : 'tristeza',
    angry    : 'irritacao',
    fearful  : 'apreensao',
    disgusted: 'desconforto',
  };

  const top3 = emotions.slice(0, 3);
  const emocaoLabel = NOMES_PT[emotionKey] || emotionKey;

  // Linha resumida das emocoes para o prompt
  const resumoEmocoes = top3
    .map(function(e) { return e.name + ' (' + e.pct + '%)'; })
    .join(', ');

  const prompt =
    'Você é a IA do NEURO LAB, um projeto de saúde digital apresentado em uma feira de tecnologia universitária.' +
    ' Seu papel é falar diretamente com o visitante de forma acolhedora e simples.' +
    '\n\n' +
    'O scan emocional detectou o seguinte na expressão do visitante:' +
    '\n- Sinal principal: ' + emocaoLabel +
    '\n- Detalhes: ' + resumoEmocoes +
    '\n\n' +
    'Escreva uma abertura curta e 3 dicas práticas de bem-estar.' +
    '\n\n' +
    'REGRAS DE TOM — siga exatamente:' +
    '\n- Escreva como se estivesse conversando com a pessoa, não fazendo um relatório' +
    '\n- Use frases curtas. Evite termos técnicos de psicologia ou neurociência' +
    '\n- Não diga "seu sistema nervoso", "coerência cardíaca" ou palavras científicas complexas' +
    '\n- Em vez de "detectamos X", prefira "durante o scan, sua expressão apresentou..." ou "o resultado sugere..."' +
    '\n- Não afirme certeza sobre o que a pessoa está sentindo — use "parece", "o scan identificou sinais de", "seu resultado mostrou"' +
    '\n- Não mencione diagnósticos, doenças ou condições médicas' +
    '\n- Cada dica deve ser prática e fácil de aplicar ainda hoje' +
    '\n- A abertura: 1 a 2 frases, humana, relacionada ao estado detectado' +
    '\n- O visitante pode ter qualquer idade — escreva para qualquer pessoa entender' +
    '\n\n' +
    'Responda APENAS com JSON válido, sem markdown, sem explicações:' +
    '\n{"abertura":"...","dicas":["...","...","..."]}';

  // Timeout: o SDK aborta a requisição em TIMEOUT_MS e não faz retry
  // (o padrão do SDK são 2 retries, que estourariam o tempo na feira).
  // O Promise.race é uma segunda garantia caso o abort demore.
  let timer;
  const chamadaAPI = anthropicClient.messages.create({
    model      : ANTHROPIC_MODEL,
    max_tokens : 400,
    messages   : [{ role: 'user', content: prompt }],
  }, { timeout: TIMEOUT_MS, maxRetries: 0 });

  const timeout = new Promise(function(_, reject) {
    timer = setTimeout(function() {
      reject(new Error('Timeout Anthropic (' + TIMEOUT_MS + 'ms)'));
    }, TIMEOUT_MS + 500);
  });

  let response;
  try {
    response = await Promise.race([chamadaAPI, timeout]);
  } finally {
    clearTimeout(timer);
  }

  // Extrair texto da resposta
  const texto = (response.content || [])
    .filter(function(b) { return b.type === 'text'; })
    .map(function(b)    { return b.text; })
    .join('');

  if (!texto) throw new Error('Resposta vazia da Anthropic');

  // Parse do JSON — se falhar, o caller usa fallback.
  // Recorta do primeiro "{" ao último "}" para tolerar texto ou
  // cercas ```json antes/depois do objeto.
  const inicio = texto.indexOf('{');
  const fim    = texto.lastIndexOf('}');
  if (inicio === -1 || fim <= inicio) throw new Error('Resposta da Anthropic sem JSON');
  const parsed = JSON.parse(texto.slice(inicio, fim + 1));

  // Validar estrutura minima — strings não vazias em todos os campos
  const textoOk = function(s) { return typeof s === 'string' && s.trim().length > 0; };
  if (!parsed || !textoOk(parsed.abertura) ||
      !Array.isArray(parsed.dicas)        ||
      parsed.dicas.length < 3             ||
      !parsed.dicas.slice(0, 3).every(textoOk)) {
    throw new Error('Estrutura JSON invalida na resposta da Anthropic');
  }

  return {
    abertura: parsed.abertura.trim(),
    dicas   : parsed.dicas.slice(0, 3).map(function(d) { return d.trim(); }),
  };
}

/* ════════════════════════════════════════════════════════════════
   FALLBACK OFFLINE
   ════════════════════════════════════════════════════════════════ */

/**
 * Retorna conteudo do fallback.json para uma emocao dominante.
 * Se a emocao nao existir, usa "neutral".
 */
function getFallbackContent(emotionKey) {
  const chave = fallback[emotionKey] ? emotionKey : 'neutral';
  const dados = fallback[chave];

  if (!dados) {
    return {
      abertura: 'Analise emocional concluida. Cuide-se bem.',
      dicas   : [
        'Mantenha uma rotina de sono regular — e a base de qualquer bem-estar.',
        'Reserve 10 minutos por dia para uma atividade prazerosa sem tela.',
        'Conecte-se com pessoas que te fazem bem. Vinculos sociais saudaveis sao protecao.',
      ],
    };
  }

  return {
    abertura: dados.abertura,
    dicas   : Array.isArray(dados.dicas) ? dados.dicas : [],
  };
}

/* ════════════════════════════════════════════════════════════════
   PERSISTENCIA
   ════════════════════════════════════════════════════════════════ */

/**
 * Le sessions.json, adiciona a nova sessao e grava de volta.
 * Cria o arquivo se nao existir.
 */
function gravarSessao(sessao) {
  const pastaData = path.dirname(SESSIONS_PATH);
  if (!fs.existsSync(pastaData)) {
    fs.mkdirSync(pastaData, { recursive: true });
  }

  let sessoes = [];
  try {
    sessoes = lerSessoes();
  } catch (err) {
    // Arquivo corrompido: guarda uma cópia antes de recomeçar,
    // para não perder o histórico do dia sem chance de recuperação.
    const backup = SESSIONS_PATH.replace(/\.json$/, `.corrompido-${Date.now()}.json`);
    try { fs.copyFileSync(SESSIONS_PATH, backup); } catch (_) { /* sem cópia possível */ }
    console.warn(`[relatorio] sessions.json corrompido (${err.message}). Cópia salva em ${path.basename(backup)}; recomeçando.`);
    sessoes = [];
  }

  sessoes.unshift(sessao);

  // Escrita atômica: grava num arquivo temporário e renomeia.
  // Se o notebook desligar no meio, o sessions.json antigo continua inteiro.
  const tmp = SESSIONS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(sessoes, null, 2), 'utf8');
  fs.renameSync(tmp, SESSIONS_PATH);
}

module.exports = { handleRelatorio };
