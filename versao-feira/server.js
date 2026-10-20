/* ═══════════════════════════════════════════════════════════════
   NEURO LAB — server.js
   Sessao 2: endpoint POST /api/relatorio com fallback offline

   O QUE ESTE ARQUIVO FAZ AGORA:
   - Serve todos os arquivos estaticos do projeto
   - POST /api/relatorio: valida payload, usa fallback.json,
     grava sessao em data/sessions.json, retorna URL + conteudo
   - Roda na porta 3000, acessivel em toda a rede local

   - GET /relatorio/:id: pagina HTML do relatorio (celular)
   - GET /api/sessoes: estatisticas do dia para painel/coletivo.html
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// Carregar o .env ANTES de qualquer require('./api/...'): o relatorio.js
// lê ANTHROPIC_API_KEY no carregamento do módulo.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');
const os      = require('os');
const path    = require('path');
const fs      = require('fs');

// Handlers dos endpoints
const { handleRelatorio }                                  = require('./api/relatorio');
const { handleGetRelatorio, handleGetSessoes, lerSessoes } = require('./api/sessoes');

const app          = express();
const PORT         = process.env.PORT || 3000;

// URL que vai no QR (o celular do visitante precisa alcançá-la).
// O HUD abre em localhost (câmera exige contexto seguro), então o
// endereço do QR não pode vir do navegador — vem daqui.
// Lida a cada requisição: se o hotspot reiniciar e o IP mudar, o QR acompanha.
app.locals.getUrlPublica = () => resolverUrlPublica().url;

// ── ACESSO DE FORA DO PC (rede local ou túnel) ────────────────
// Só o próprio PC usa tudo: HUD e painel (localhost) e o Quest, que chega
// pelo adb reverse — o adb entrega a conexão em 127.0.0.1. Quem vem de
// outro aparelho (celular no Wi-Fi/hotspot) ou pelo túnel só pode abrir o
// próprio relatório (/relatorio/:id — a página não carrega nenhum outro
// arquivo). HUD, painel, VR, APIs e data/ ficam fechados.
// O cloudflared também conecta em localhost, então o IP de origem não
// basta: a Cloudflare marca toda requisição com estes cabeçalhos.
function veioPeloTunel(req) {
  return Boolean(req.headers['cf-connecting-ip'] || req.headers['cf-ray'])
      || /cloudflare/i.test(req.headers['cdn-loop'] || '')
      || /\.trycloudflare\.com$/i.test(req.hostname || '');
}

// Endereço real do socket (não usa X-Forwarded-For, que o cliente pode forjar)
function veioDoProprioPC(req) {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

app.use((req, res, next) => {
  if (veioDoProprioPC(req) && !veioPeloTunel(req)) return next();
  // só o formato do UUID da sessão (evita servir relatorio/template.html cru)
  if ((req.method === 'GET' || req.method === 'HEAD') && /^\/relatorio\/[0-9a-f-]+\/?$/i.test(req.path)) return next();
  res.status(403).type('text/plain; charset=utf-8')
     .send('NEURO LAB — por este endereço só é possível abrir o relatório do QR code.');
});

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── ARQUIVOS ESTATICOS ────────────────────────────────────────
app.use(express.static(path.join(__dirname)));

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/ping', (req, res) => {
  res.json({
    status : 'ok',
    projeto: 'NEURO LAB',
    versao : '2.1.0',
    fase   : 'Fase VR — dados da sessão acessíveis no VR',
    hora   : new Date().toLocaleTimeString('pt-BR'),
    qr     : app.locals.getUrlPublica(), // lido pelo INICIAR_FEIRA.bat
  });
});

// ── POST /api/relatorio ───────────────────────────────────────
app.post('/api/relatorio', handleRelatorio);

// ── SESSÃO VR ATIVA ───────────────────────────────────────────
// O Quest abre sempre a mesma URL (localhost:3000/vr/lab.html via
// adb reverse), sem ?id. Por isso o botão ENTRAR do index.html
// registra aqui qual sessão vai para o headset, e o lab.html busca
// GET /api/sessao/ativa. Gravado em disco para sobreviver a reinício.
const VR_ATIVA_PATH = path.join(__dirname, 'data', 'vr_ativa.json');
const VR_ATIVA_TTL  = 15 * 60 * 1000; // após 15 min, não reaproveita (evita dados do visitante anterior)

// POST /api/vr/ativa  { id: UUID | null }
app.post('/api/vr/ativa', (req, res) => {
  const id = typeof req.body?.id === 'string' ? req.body.id : null;
  try {
    fs.mkdirSync(path.dirname(VR_ATIVA_PATH), { recursive: true });
    fs.writeFileSync(VR_ATIVA_PATH, JSON.stringify({ id, desde: Date.now() }), 'utf8');
    console.log(`[vr] Sessão ativa no Quest: ${id ? id.slice(0, 8) : '(nenhuma — experiência genérica)'}`);
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[vr/ativa] Erro:', err.message);
    return res.status(500).json({ ok: false, erro: 'Erro ao registrar sessão ativa' });
  }
});

// GET /api/sessao/ativa — precisa vir antes de /api/sessao/:id
app.get('/api/sessao/ativa', (req, res) => {
  let ativa = null;
  try {
    ativa = JSON.parse(fs.readFileSync(VR_ATIVA_PATH, 'utf8'));
  } catch { /* arquivo ainda não existe */ }

  if (!ativa?.id || typeof ativa.desde !== 'number' || Date.now() - ativa.desde > VR_ATIVA_TTL) {
    return res.status(404).json({ ok: false, erro: 'Nenhuma sessão ativa' });
  }
  return responderSessao(ativa.id, res);
});

// ── GET /api/sessao/:id ───────────────────────────────────────
// Retorna JSON com os dados da sessão para o vr/lab.html.
// Não envolve template HTML nem API key — só lê o sessions.json.
app.get('/api/sessao/:id', (req, res) => responderSessao(req.params.id, res));

function responderSessao(id, res) {
  try {
    const sessao = lerSessoes().find(s => s && s.id === id);
    if (!sessao) {
      return res.status(404).json({ ok: false, erro: 'Sessão não encontrada' });
    }
    // Apenas os campos que o VR precisa — sem dados desnecessários
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok       : true,
      id       : sessao.id,
      emotions : sessao.emotions  || [],
      dominant : sessao.dominant  || 'neutral',
      abertura : sessao.abertura  || '',
      timestamp: sessao.timestamp || null,
    });
  } catch (err) {
    console.error('[api/sessao] Erro:', err.message);
    return res.status(500).json({ ok: false, erro: 'Erro ao ler sessão' });
  }
}

// ── GET /relatorio/:id ────────────────────────────────────────
app.get('/relatorio/:id', handleGetRelatorio);

// ── GET /api/sessoes ──────────────────────────────────────────
app.get('/api/sessoes', handleGetSessoes);

// ── ERROS ─────────────────────────────────────────────────────
// JSON malformado no body (express.json) ou erro inesperado numa rota:
// responde JSON em vez da página HTML padrão do Express.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.type === 'entity.parse.failed' ? 400 : (err.status || 500);
  if (status >= 500) console.error(`[server] Erro em ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ ok: false, erro: status === 400 ? 'JSON inválido' : 'Erro interno' });
});

// Promise rejeitada sem catch em qualquer handler async: registra no log
// em vez de derrubar o servidor no meio da feira (padrão do Node >= 15).
process.on('unhandledRejection', (reason) => {
  console.error('[server] Promise rejeitada sem tratamento:', reason);
});

// ── INICIALIZACAO ─────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const publica = resolverUrlPublica();
  const ips     = listarIPs();

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║         NEURO LAB — Servidor ativo       ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  HUD (abrir no PC):  http://localhost:${PORT}`);
  console.log(`║  Painel:             http://localhost:${PORT}/painel/coletivo.html`);
  console.log('║');
  console.log(`║  QR do relatório →   ${publica.url}`);
  console.log(`║    (origem: ${publica.origem})`);
  console.log('║');
  console.log('║  IPs desta máquina:');
  if (ips.length === 0) console.log('║    (nenhum — conecte no Wi-Fi/hotspot)');
  for (const ip of ips) {
    const marca = ip.virtual ? '  (virtual, ignorado)'
                : ip.escolhido && publica.origem.startsWith('detectado') ? '  ← usado no QR'
                : '';
    console.log(`║    ${ip.address.padEnd(15)}  ${ip.nome}${marca}`);
  }
  if (publica.origem.startsWith('nenhum')) {
    console.log('║');
    console.log('║  ⚠ SEM REDE: o QR não vai abrir no celular.');
    console.log('║    Conecte no hotspot — o QR passa a usar o IP novo sozinho.');
  }
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  Fase VR — v2.1.0                        ║');
  console.log('║  Rotas ativas:                            ║');
  console.log('║    POST /api/relatorio  → Anthropic+fallback║');
  console.log('║    GET  /api/sessao/:id → JSON para o VR ║');
  console.log('║    GET  /api/sessao/ativa → sessão no Quest ║');
  console.log('║    POST /api/vr/ativa   → botão ENTRAR   ║');
  console.log('║    GET  /relatorio/:id  → HTML (celular) ║');
  console.log('║    GET  /api/sessoes    → stats do dia   ║');
  console.log('║    /painel/coletivo.html → painel (TV)   ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

// ── HELPERS ───────────────────────────────────────────────────

/**
 * URL pública (a que vai no QR), nesta ordem:
 *   1. PUBLIC_URL          (ex.: https://xxx.trycloudflare.com — o INICIAR_FEIRA.bat
 *                           define na variável de ambiente; também vale no .env)
 *   2. LOCAL_IP do .env    (ex.: 192.168.43.120 — a porta é acrescentada)
 *   3. IP de rede detectado (Wi-Fi tem prioridade)
 * Retorna { url, origem } — origem aparece no banner.
 */
function resolverUrlPublica() {
  const publicUrl = (process.env.PUBLIC_URL || '').trim();
  if (publicUrl) {
    const url = /^https?:\/\//i.test(publicUrl) ? publicUrl : `http://${publicUrl}`;
    return { url: url.replace(/\/+$/, ''), origem: 'PUBLIC_URL (túnel ou .env)' };
  }

  const localIp = (process.env.LOCAL_IP || '').trim();
  if (localIp) {
    const comPorta = /:\d+$/.test(localIp) ? localIp : `${localIp}:${PORT}`;
    return { url: `http://${comPorta}`, origem: 'LOCAL_IP do .env' };
  }

  const escolhido = listarIPs().find(ip => ip.escolhido);
  if (escolhido) {
    return { url: `http://${escolhido.address}:${PORT}`, origem: `detectado (${escolhido.nome})` };
  }
  return { url: `http://localhost:${PORT}`, origem: 'nenhum IP de rede — QR só funciona neste PC' };
}

// Adaptadores que não levam ao celular do visitante
const ADAPTADOR_VIRTUAL = /vethernet|virtualbox|vmware|hyper-v|wsl|docker|vpn|hamachi|tailscale|zerotier|bluetooth|loopback/i;
const ADAPTADOR_WIFI    = /wi-?fi|wlan|wireless|sem fio/i;

/**
 * Todos os IPv4 de rede da máquina, com o escolhido para o QR marcado.
 * Prioridade: Wi-Fi → outros adaptadores físicos. Ignora virtuais e
 * 169.254.x (sem DHCP); entre iguais, prefere faixas privadas.
 */
function listarIPs() {
  const ips = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    for (const iface of lista || []) {
      // family é 'IPv4' no Node >= 18.4 e 4 no 18.0–18.3
      if ((iface.family !== 'IPv4' && iface.family !== 4) || iface.internal) continue;
      ips.push({
        nome,
        address  : iface.address,
        virtual  : ADAPTADOR_VIRTUAL.test(nome) || iface.address.startsWith('169.254.'),
        wifi     : ADAPTADOR_WIFI.test(nome),
        privado  : /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(iface.address),
        escolhido: false,
      });
    }
  }

  const pontos    = ip => (ip.wifi ? 2 : 0) + (ip.privado ? 1 : 0);
  const candidato = ips.filter(ip => !ip.virtual).sort((a, b) => pontos(b) - pontos(a))[0];
  if (candidato) candidato.escolhido = true;
  return ips;
}
