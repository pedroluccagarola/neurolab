/* ═══════════════════════════════════════════════════════════════
   NEURO LAB — api/sessoes.js
   Handlers relacionados a sessões:
     - handleGetRelatorio : GET /relatorio/:id
       Busca a sessão no sessions.json, injeta os dados no
       template HTML e retorna a página completa ao celular.
     - handleGetSessoes   : GET /api/sessoes   (Sessão 4)
       Estatísticas do dia para o painel coletivo.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const fs   = require('fs');
const path = require('path');

const SESSIONS_PATH  = path.join(__dirname, '..', 'data', 'sessions.json');
const TEMPLATE_PATH  = path.join(__dirname, '..', 'relatorio', 'template.html');

// Carrega o template uma vez — sem re-leitura a cada requisição.
// Se o arquivo mudar, reiniciar o servidor para recarregar.
let templateHtml;
try {
  templateHtml = fs.readFileSync(TEMPLATE_PATH, 'utf8');
} catch (err) {
  console.error('[sessoes] ERRO: template.html não encontrado em', TEMPLATE_PATH);
  templateHtml = null;
}

/* ── LEITURA DO sessions.json ────────────────────────────────── */

/**
 * Lê data/sessions.json e sempre retorna um array.
 *   - arquivo inexistente ou vazio → []  (primeiro dia da feira)
 *   - JSON inválido ou não-array   → lança erro (o caller responde 500)
 * Usado por todas as rotas de leitura para tratarem o arquivo igual.
 */
function lerSessoes() {
  let conteudo;
  try {
    conteudo = fs.readFileSync(SESSIONS_PATH, 'utf8').trim();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  if (!conteudo) return [];
  const sessoes = JSON.parse(conteudo);
  if (!Array.isArray(sessoes)) throw new Error('sessions.json não contém um array');
  return sessoes;
}

/* ── GET /relatorio/:id ──────────────────────────────────────── */

/**
 * Busca a sessão pelo UUID, injeta no template e retorna o HTML.
 * Acessado pelo celular do visitante ao escanear o QR code.
 *
 * Cenários tratados:
 *   - Template não carregado  → 500 com página de erro clara
 *   - UUID não encontrado     → 404 com página de erro elegante
 *   - Sessão encontrada       → 200 com a página completa
 */
function handleGetRelatorio(req, res) {
  const { id } = req.params;

  // ── 1. VERIFICAR TEMPLATE ─────────────────────────────────
  if (!templateHtml) {
    return res.status(500).send(paginaErro(
      'Erro de configuração',
      'O template do relatório não foi carregado. Verifique o arquivo relatorio/template.html.',
    ));
  }

  // ── 2. BUSCAR SESSÃO ──────────────────────────────────────
  let sessoes = [];
  try {
    sessoes = lerSessoes();
  } catch (err) {
    console.error('[sessoes] Erro ao ler sessions.json:', err.message);
    return res.status(500).send(paginaErro(
      'Erro ao acessar dados',
      'Não foi possível ler os dados da sessão. Tente novamente.',
    ));
  }

  const sessao = sessoes.find(s => s && s.id === id);

  if (!sessao) {
    console.warn(`[sessoes] UUID não encontrado: ${id}`);
    return res.status(404).send(paginaErro(
      'Relatório não encontrado',
      `A sessão "${id.slice(0, 8)}..." não existe ou expirou.`,
    ));
  }

  // ── 3. RENDERIZAR TEMPLATE ────────────────────────────────
  const html = renderTemplate(sessao);

  console.log(`[sessoes] ✓ Relatório entregue | sessão ${id.slice(0, 8)} | dominant: ${sessao.dominant}`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

/* ── GET /api/sessoes ────────────────────────────────────────── */

// Ordem fixa das emoções — mesmos rótulos do scan.js (EMOTION_LABELS)
const EMOCOES = [
  { key: 'happy',     label: 'Feliz'      },
  { key: 'neutral',   label: 'Tranquilo'  },
  { key: 'surprised', label: 'Surpreso'   },
  { key: 'sad',       label: 'Triste'     },
  { key: 'angry',     label: 'Irritado'   },
  { key: 'fearful',   label: 'Apreensivo' },
  { key: 'disgusted', label: 'Incomodado' },
];

/**
 * Estatísticas agregadas para o painel coletivo (painel/coletivo.html).
 * Cada sessão conta como um visitante; a emoção de cada visitante é
 * o campo `dominant` da sessão.
 *
 * "Hoje" usa o fuso local do servidor (o notebook da feira), não UTC.
 * Query opcional ?data=AAAA-MM-DD para consultar outro dia (testes).
 *
 * Resposta:
 *   { ok, data, total_hoje, total_geral,
 *     dominante: { key, label, count, pct } | null,
 *     distribuicao: [{ key, label, count, pct }]  (ordem decrescente),
 *     ultimo_scan, atualizado_em }
 */
function handleGetSessoes(req, res) {
  let sessoes = [];
  try {
    sessoes = lerSessoes();
  } catch (err) {
    console.error('[sessoes] Erro ao ler sessions.json:', err.message);
    return res.status(500).json({ ok: false, erro: 'Erro ao ler sessões' });
  }

  const pedida = String(req.query.data || '');
  const dia    = /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : chaveDiaLocal(new Date());

  const doDia = sessoes.filter(s => {
    if (!s) return false;
    const d = new Date(s.timestamp);
    return !isNaN(d) && chaveDiaLocal(d) === dia;
  });

  const contagem = Object.fromEntries(EMOCOES.map(e => [e.key, 0]));
  for (const s of doDia) {
    const key = s.dominant in contagem ? s.dominant : 'neutral';
    contagem[key]++;
  }

  const total = doDia.length;
  const distribuicao = EMOCOES
    .map(e => ({
      key  : e.key,
      label: e.label,
      count: contagem[e.key],
      pct  : total ? Math.round((contagem[e.key] / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count); // sort estável: empate mantém ordem de EMOCOES

  const ultimo = doDia.reduce((max, s) => (!max || s.timestamp > max ? s.timestamp : max), null);

  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    ok          : true,
    data        : dia,
    total_hoje  : total,
    total_geral : sessoes.length,
    dominante   : total ? distribuicao[0] : null,
    distribuicao,
    ultimo_scan : ultimo,
    atualizado_em: new Date().toISOString(),
  });
}

/** AAAA-MM-DD no fuso local do servidor. */
function chaveDiaLocal(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* ── RENDERIZAÇÃO DO TEMPLATE ────────────────────────────────── */

/**
 * Substitui todos os placeholders {{CHAVE}} pelos dados reais da sessão.
 * Sem dependências de template engine — string.replace() direto.
 *
 * @param   {Object} sessao  - objeto de sessão do sessions.json
 * @returns {string}         - HTML completo pronto para enviar
 */
function renderTemplate(sessao) {
  const emocoes   = Array.isArray(sessao.emotions) ? sessao.emotions : [];
  const dominante = emocoes[0] || { name: 'Neutro', pct: 0 };
  const secundarias = emocoes.slice(1);

  // Cores das barras secundárias — alterna entre violet e green
  const coresSecundarias = ['#7C3AED', '#00FF88'];

  // ── Linhas de emoções secundárias ─────────────────────────
  const emotionsRows = secundarias.map((e, i) => {
    const cor = coresSecundarias[i % coresSecundarias.length];
    return `
    <div class="emotion-row">
      <span class="emotion-row-name">${escapar(e.name)}</span>
      <div class="emotion-row-track">
        <div class="emotion-row-fill" style="width:${e.pct}%;background:${cor};box-shadow:0 0 6px ${cor}"></div>
      </div>
      <span class="emotion-row-pct">${e.pct}%</span>
    </div>`.trim();
  }).join('\n    ');

  // ── Itens de dicas ─────────────────────────────────────────
  const dicasItems = (sessao.dicas || []).map((dica, i) => `
    <div class="dica-card">
      <span class="dica-num">0${i + 1}</span>
      <p class="dica-text">${escapar(dica)}</p>
    </div>`.trim()
  ).join('\n    ');

  // ── Timestamp formatado ────────────────────────────────────
  let tsFormatado = '—';
  try {
    const d = new Date(sessao.timestamp);
    const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    tsFormatado = `${data} · ${hora}`;
  } catch (_) { /* deixa '—' */ }

  // ── Substituições ──────────────────────────────────────────
  return templateHtml
    .replace(/\{\{SESSION_ID_SHORT\}\}/g,      escapar(sessao.id?.slice(0, 8) ?? '—'))
    .replace(/\{\{TIMESTAMP_FORMATTED\}\}/g,   tsFormatado)
    .replace(/\{\{DOMINANT_NAME\}\}/g,         escapar(dominante.name))
    .replace(/\{\{DOMINANT_PCT\}\}/g,          String(dominante.pct))
    .replace(/\{\{EMOTIONS_ROWS\}\}/g,         emotionsRows)
    .replace(/\{\{ABERTURA\}\}/g,              escapar(sessao.abertura ?? ''))
    .replace(/\{\{DICAS_ITEMS\}\}/g,           dicasItems)
    .replace(/\{\{FONTE\}\}/g,                 escapar(sessao.fonte ?? 'fallback'))
    .replace(/\{\{DURACAO_MS\}\}/g,            String(sessao.duracao_ms ?? 0));
}

/* ── PÁGINA DE ERRO ELEGANTE ─────────────────────────────────── */

/**
 * Retorna uma página HTML de erro simples mas estilizada —
 * nunca uma tela branca de 404/500 padrão do Express.
 */
function paginaErro(titulo, mensagem) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEURO LAB — Erro</title>
<style>
  body { background:#080D1A; color:#CBD5E1; font-family:monospace;
         display:flex; flex-direction:column; align-items:center;
         justify-content:center; min-height:100vh; padding:2rem; text-align:center; }
  .dot { width:10px; height:10px; border-radius:50%; background:#00E5FF;
         box-shadow:0 0 14px #00E5FF; margin:0 auto 20px; }
  h1 { font-size:14px; letter-spacing:.2em; color:#00E5FF;
       text-transform:uppercase; margin-bottom:12px; }
  p  { font-size:12px; color:#64748B; line-height:1.6; max-width:320px; }
</style>
</head>
<body>
  <div class="dot"></div>
  <h1>${titulo}</h1>
  <p>${mensagem}</p>
</body>
</html>`;
}

/* ── UTILITÁRIO ──────────────────────────────────────────────── */

/**
 * Escapa caracteres HTML para prevenir XSS nos dados injetados.
 * Essencial porque os dados vêm do Face-api / LLM externo.
 */
function escapar(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#x27;');
}

module.exports = { handleGetRelatorio, handleGetSessoes, lerSessoes };
