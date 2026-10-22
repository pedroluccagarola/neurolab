/* ═══════════════════════════════════════════════════════════════════
   NEURO LAB — js/explicacao.js
   Tela opcional "Como a IA chegou nisso", usada pelo HUD (painel por
   cima do resultado) e pelo relatório (seção que abre e fecha).

   NL_EXPLICACAO.montar(container, resultado)
     resultado = { emotions:[{key,name,pct}], manual, leituras }
     (o mesmo formato de NL_DADOS.decodificar e do NLScan)

   Explica com os números da própria pessoa:
     - as 7 expressões em barras, com as porcentagens do modelo
     - por que a expressão em destaque foi escolhida (calibração)
     - que "neutro" no modelo aparece como "Tranquilo" no site
     - o limite: a IA lê expressões do rosto, não sentimentos, e pode errar
   Tudo via textContent: nada do link vira HTML.

   O visual se adapta à página: o CSS abaixo usa as cores da paleta e as
   variáveis --xp-mono / --xp-sans, que cada página define.
   ═══════════════════════════════════════════════════════════════════ */

const NL_EXPLICACAO = (() => {

  const CSS = `
.xp{--xp-c:#00E5FF;--xp-v:#7C3AED;--xp-g:#00FF88;--xp-a:#FFB800;--xp-off:#CBD5E1;--xp-mut:#64748B;
  font-family:var(--xp-sans);color:var(--xp-off);text-align:left}
.xp-sec{margin-bottom:16px}
.xp-sec:last-child{margin-bottom:0}
.xp-h{font-family:var(--xp-mono);font-size:var(--xp-h-size,10px);letter-spacing:.16em;
  color:var(--xp-c);text-transform:uppercase;margin-bottom:9px}
.xp-p{font-size:var(--xp-p-size,13px);line-height:1.6;color:var(--xp-off)}
.xp-p + .xp-p{margin-top:6px}
.xp-p b{color:#fff;font-weight:700}
.xp-row{display:grid;grid-template-columns:minmax(0,1.7fr) 1.6fr 40px;align-items:center;gap:8px;margin-bottom:6px}
.xp-name{font-weight:700;font-size:var(--xp-p-size,13px);text-transform:uppercase;letter-spacing:.04em;
  color:var(--xp-off);line-height:1.25}
.xp-name small{display:inline-block;font-weight:400;text-transform:none;letter-spacing:0;color:#94A3B8}
.xp-track{height:6px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
.xp-fill{height:100%;border-radius:3px;background:rgba(203,213,225,.45)}
.xp-pct{font-family:var(--xp-mono);font-size:var(--xp-p-size,13px);text-align:right;color:var(--xp-off)}
.xp-row.top .xp-name,.xp-row.top .xp-pct{color:var(--xp-c)}
.xp-row.top .xp-fill{background:var(--xp-c);box-shadow:0 0 8px var(--xp-c)}
.xp-tag{display:inline-block;margin-left:6px;padding:1px 5px;border:1px solid var(--xp-c);
  font-family:var(--xp-mono);font-size:8px;letter-spacing:.12em;color:var(--xp-c);vertical-align:2px}
.xp-list{list-style:none;display:flex;flex-direction:column;gap:7px}
.xp-list li{position:relative;padding-left:14px;font-size:var(--xp-p-size,13px);line-height:1.55}
.xp-list li::before{content:'';position:absolute;left:0;top:.6em;width:6px;height:6px;background:var(--xp-v)}
.xp-box{padding:11px 13px;border:1px solid rgba(255,184,0,.35);background:rgba(255,184,0,.05)}
.xp-box .xp-h{color:var(--xp-a)}
.xp-box.info{border-color:rgba(124,58,237,.5);background:rgba(124,58,237,.07)}
.xp-box.info .xp-h{color:#A78BFA}
.xp-note{font-size:12px;color:#94A3B8;margin-top:8px;line-height:1.5}
`;

  function estilo() {
    if (document.getElementById('xp-estilo')) return;
    const st = document.createElement('style');
    st.id = 'xp-estilo';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /** Cria um elemento com classe e texto (sempre textContent). */
  function el(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto != null) e.textContent = texto;
    return e;
  }

  /** Parágrafo com trechos em negrito: partes = ['texto', {b:'negrito'}, ...] */
  function par(partes, cls = 'xp-p') {
    const p = el('p', cls);
    partes.forEach(x => p.append(typeof x === 'string' ? x : el('b', null, x.b)));
    return p;
  }

  function secao(titulo, ...filhos) {
    const s = el('div', 'xp-sec');
    if (titulo) s.appendChild(el('div', 'xp-h', titulo));
    filhos.forEach(f => s.appendChild(f));
    return s;
  }

  const nomeMin = e => e.name.toLowerCase();

  /** Por que esta expressão ficou em destaque — com os números da pessoa. */
  function porqueDestaque(emotions) {
    const C = NL_DADOS.CALIBRACAO;
    const top = emotions[0];
    const neutro = emotions.find(e => e.key === 'neutral');

    if (top.key === 'neutral') {
      if (top.pct >= C.NEUTRO_MIN) {
        return [`O modelo marcou neutro (Tranquilo) com `, { b: `${top.pct}%` },
                `. Como passou de ${C.NEUTRO_MIN}%, ele ficou em destaque.`];
      }
      return [`Neutro (Tranquilo) ficou com `, { b: `${top.pct}%` }, `, abaixo de ${C.NEUTRO_MIN}%, mas nenhuma outra expressão chegou a ${C.OUTRA_MIN}%. Por isso ele continuou em destaque.`];
    }
    if (neutro && neutro.pct > top.pct) {
      if (top.pct >= C.OUTRA_MIN) {
        return [`Neutro teve a maior porcentagem (`, { b: `${neutro.pct}%` }, `), mas ficou abaixo de ${C.NEUTRO_MIN}%. Como ${top.name} chegou a `,
                { b: `${top.pct}%` }, ` (${C.OUTRA_MIN}% ou mais), essa expressão assumiu o destaque.`];
      }
      return [`Neutro teve `, { b: `${neutro.pct}%` }, ` e ${top.name} `, { b: `${top.pct}%` },
              `. Na hora de ordenar, as expressões diferentes de neutro contam um pouco mais, e por isso ${top.name} ficou em destaque.`];
    }
    return [{ b: top.name }, ` teve a maior porcentagem (`, { b: `${top.pct}%` }, `), então ficou em destaque. A calibração não precisou mudar nada.`];
  }

  function montar(container, r) {
    estilo();
    container.textContent = '';
    const raiz = el('div', 'xp');
    const C = NL_DADOS.CALIBRACAO;

    if (!r || !r.emotions || !r.emotions.length) {
      raiz.appendChild(par(['Nenhum resultado neste link para explicar.']));
      container.appendChild(raiz);
      return;
    }

    /* ── Pular scan: não houve leitura ── */
    if (r.manual) {
      const box = el('div', 'xp-box info');
      box.appendChild(el('div', 'xp-h', 'Não houve leitura do rosto'));
      box.appendChild(par(['Você usou o ', { b: 'Pular scan' }, ' e escolheu ', { b: r.emotions[0].name },
        '. A câmera não foi usada e a IA não analisou nada; por isso não há porcentagens nesta sessão.']));
      raiz.appendChild(secao(null, box));
      raiz.appendChild(secao('Se você fizer o scan',
        par(['A IA estima, pela imagem da câmera (que nunca sai do aparelho), quanto cada uma de 7 expressões aparece no rosto. ',
             'Depois, uma calibração escolhe qual delas fica em destaque. Esta tela mostra esses números quando o scan é feito com a câmera.'])));
      raiz.appendChild(limites());
      container.appendChild(raiz);
      return;
    }

    /* ── 1. As 7 expressões em barras ── */
    const barras = el('div');
    const ordenadas = [...r.emotions].sort((a, b) => b.pct - a.pct);
    ordenadas.forEach(e => {
      const linha = el('div', 'xp-row' + (e.key === r.emotions[0].key ? ' top' : ''));
      const nome = el('div', 'xp-name', e.name);
      // espaço fora do <small>: dentro de um inline-block ele some na tela
      nome.append(' ', el('small', null, `(${NL_DADOS.MODELO[e.key] || e.key})`)); // nome no modelo
      const trilho = el('div', 'xp-track');
      const fill = el('div', 'xp-fill');
      fill.style.width = Math.max(0, Math.min(100, e.pct)) + '%';
      trilho.appendChild(fill);
      const pct = el('div', 'xp-pct', e.pct + '%');
      linha.append(nome, trilho, pct);
      barras.appendChild(linha);
    });
    const destaque = barras.querySelector('.xp-row.top .xp-name');
    if (destaque) destaque.appendChild(el('span', 'xp-tag', 'DESTAQUE'));
    const secBarras = secao(r.emotions.length >= 7 ? 'As 7 expressões que o modelo estimou' : 'As expressões guardadas neste link', barras);
    secBarras.appendChild(el('p', 'xp-note', 'Entre parênteses, o nome que o modelo usa (traduzido do inglês). O site mostra nomes mais leves.'));
    if (r.emotions.length < 7) {
      secBarras.appendChild(el('p', 'xp-note', 'Este link é de uma versão anterior do site e guarda só as 3 expressões principais.'));
    }
    raiz.appendChild(secBarras);

    /* ── 2. Por que esta ficou em destaque ── */
    raiz.appendChild(secao('Por que ' + nomeMin(r.emotions[0]) + ' ficou em destaque', par(porqueDestaque(r.emotions))));

    /* ── 3. As regras da calibração ── */
    const n = r.leituras;
    const regras = el('ul', 'xp-list');
    [
      ['O resultado é a ', { b: n ? `média de ${n} leitura${n > 1 ? 's' : ''}` : `média de até ${C.AMOSTRAS} leituras` },
       ' do rosto, feitas em cerca de 1 segundo. Assim, uma careta rápida não decide sozinha.'],
      ['Com o rosto parado, o modelo tende a marcar neutro. Por isso, ', { b: `neutro só fica em destaque com ${C.NEUTRO_MIN}% ou mais` }, '.'],
      ['Abaixo disso, ', { b: `outra expressão assume o destaque se tiver ${C.OUTRA_MIN}% ou mais` }, '.'],
      ['A calibração só muda a ordem. ', { b: 'As porcentagens são as do modelo' }, ', sem ajuste.'],
      ['O modelo chama a expressão de repouso de ', { b: '“neutro”' }, '; aqui ela aparece como ', { b: '“Tranquilo”' }, '.'],
    ].forEach(partes => {
      const li = el('li');
      partes.forEach(x => li.append(typeof x === 'string' ? x : el('b', null, x.b)));
      regras.appendChild(li);
    });
    raiz.appendChild(secao('Como funciona a calibração', regras));

    /* ── 4. Limites ── */
    raiz.appendChild(limites());
    container.appendChild(raiz);
  }

  function limites() {
    const box = el('div', 'xp-box');
    box.appendChild(el('div', 'xp-h', 'O limite da IA'));
    box.appendChild(par(['A IA lê ', { b: 'expressões do rosto, não sentimentos' },
      '. Uma pessoa pode sorrir sem estar feliz, ou estar bem com o rosto sério.']));
    box.appendChild(par(['Luz, ângulo da câmera, óculos e o jeito de cada rosto mudam o resultado. ',
      { b: 'A IA pode errar' }, ', e isto não é diagnóstico.']));
    return secao(null, box);
  }

  return { montar };
})();
