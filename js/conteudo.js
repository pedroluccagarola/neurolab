/* ═══════════════════════════════════════════════════════════════════
   NEURO LAB — js/conteudo.js  (versão demo, sem servidor)
   Conteúdo compartilhado pelo HUD, pelo VR e pelo relatório.

   - EMOCOES:     as 7 emoções do face-api, com o nome em português
   - COMENTARIOS: frase do HUD logo após o scan (mesma da feira)
   - RELATORIO:   abertura + 3 dicas por emoção (o mesmo texto do
                  api/fallback.json usado na feira, sem chamada de API)

   O resultado passa de uma página para outra pela própria URL:
     ?e=happy:72,neutral:20,surprised:5&m=0&t=1760000000000
       e = as 7 emoções (chave:porcentagem), na ordem do resultado: a primeira
           é a que ficou em destaque. Links antigos (só 3) continuam válidos.
       n = quantas leituras do rosto entraram na média (1 a 5)
       m = 1 quando a emoção foi escolhida no "pular scan"
       t = data/hora do scan (ms)
       a = autoavaliação antes do scan (1 a 5, opcional)
       d = autoavaliação depois do VR (1 a 5, opcional)
   Nada é gravado em servidor: quem tem o link vê só esses números.
   ═══════════════════════════════════════════════════════════════════ */

const NL_DADOS = (() => {

  const EMOCOES = {
    happy:     'Feliz',
    neutral:   'Tranquilo',
    surprised: 'Surpreso',
    sad:       'Triste',
    angry:     'Irritado',
    fearful:   'Apreensivo',
    disgusted: 'Incomodado',
  };

  // Nome da categoria no modelo do face-api (em inglês), traduzido.
  // Mostrado entre parênteses na tela "Como a IA chegou nisso".
  const MODELO = {
    happy:     'alegria',
    neutral:   'neutro',
    surprised: 'surpresa',
    sad:       'tristeza',
    angry:     'raiva',
    fearful:   'medo',
    disgusted: 'nojo',
  };

  // Tom do relatório da feira: fala de sinais na expressão, sem afirmar o que
  // a pessoa sente e sem termos técnicos.
  const COMENTARIOS = {
    happy:     'Durante o scan, sua expressão mostrou sinais de alegria. Que bom começar a experiência assim.',
    sad:       'O resultado sugere um momento de reflexão. A respiração guiada no VR pode ser uma boa pausa para você.',
    angry:     'Durante o scan, sua expressão mostrou sinais de tensão. Na próxima etapa, vamos respirar com calma, sem pressa.',
    fearful:   'O resultado sugere sinais de apreensão. Na próxima etapa, vamos respirar juntos, no seu ritmo.',
    disgusted: 'Durante o scan, sua expressão mostrou sinais de desconforto. Uma pausa para respirar pode ajudar.',
    surprised: 'Durante o scan, sua expressão mostrou sinais de surpresa. Um ótimo jeito de começar algo novo.',
    neutral:   'Durante o scan, sua expressão mostrou sinais de tranquilidade. Um bom ponto de partida para o que vem a seguir.',
  };

  // Emoção escolhida no "pular scan": não houve leitura do rosto, então o
  // texto fala da escolha da pessoa, não de sinais na expressão.
  const COMENTARIOS_MANUAL = {
    happy:     'Você escolheu alegria para esta demonstração. Que bom começar a experiência assim.',
    sad:       'Você escolheu reflexão para esta demonstração. A respiração guiada no VR pode ser uma boa pausa.',
    angry:     'Você escolheu tensão para esta demonstração. Na próxima etapa, vamos respirar com calma, sem pressa.',
    fearful:   'Você escolheu apreensão para esta demonstração. Na próxima etapa, vamos respirar juntos, no seu ritmo.',
    disgusted: 'Você escolheu desconforto para esta demonstração. Uma pausa para respirar pode ajudar.',
    surprised: 'Você escolheu surpresa para esta demonstração. Um ótimo jeito de começar algo novo.',
    neutral:   'Você escolheu tranquilidade para esta demonstração. Um bom ponto de partida para o que vem a seguir.',
  };

  // Cópia do api/fallback.json da versão da feira
  const RELATORIO = {
    happy: {
      abertura: 'Durante o scan, sua expressão mostrou sinais de alegria. Que bom começar a experiência assim.',
      dicas: [
        'Anote uma coisa boa que aconteceu hoje. Leva menos de um minuto e ajuda a lembrar dela depois.',
        'Compartilhe o bom momento com alguém: mande uma mensagem ou conte pessoalmente.',
        'Se tem algo que você vem adiando, que tal dar o primeiro passo ainda hoje?',
      ],
    },
    neutral: {
      abertura: 'Durante o scan, sua expressão mostrou sinais de tranquilidade. Um bom ponto de partida para o resto do dia.',
      dicas: [
        'Se tiver algo importante para resolver, um momento tranquilo é uma boa hora para pensar com calma.',
        'Faça uma pausa de 5 minutos longe da tela — um pouco de ar ou de luz natural faz bem.',
        'Beba um copo de água agora. Parece simples, mas faz diferença ao longo do dia.',
      ],
    },
    surprised: {
      abertura: 'Durante o scan, sua expressão mostrou sinais de surpresa. Um ótimo jeito de começar algo novo.',
      dicas: [
        'Experimente algo diferente hoje: um tema novo, uma conversa ou outro caminho na volta para casa.',
        'Faça uma pergunta sobre algo que sempre pareceu óbvio. A curiosidade cresce quando a gente usa.',
        'Anote o que mais chamou sua atenção nesta experiência. Rever isso depois pode render boas ideias.',
      ],
    },
    sad: {
      abertura: 'O resultado sugere um momento de reflexão. Uma pausa com calma pode fazer bem hoje.',
      dicas: [
        'Respire devagar: inspire por 4 segundos, segure por 4 e solte por 6. Repita três vezes.',
        'Mexa o corpo um pouco: uma caminhada curta ou um alongamento de 2 minutos já fazem bem.',
        'Converse com alguém de confiança, nem que seja para trocar algumas palavras.',
      ],
    },
    angry: {
      abertura: 'Durante o scan, sua expressão mostrou sinais de tensão. Uma pausa curta pode cair bem agora.',
      dicas: [
        'Antes de uma decisão importante, espere alguns minutos e respire fundo algumas vezes.',
        'Movimente-se: alguns minutos de caminhada ou alongamento ajudam a soltar os ombros e o corpo.',
        'Se algo estiver te incomodando, tente descrever em uma frase. Colocar em palavras ajuda a ver com mais calma.',
      ],
    },
    fearful: {
      abertura: 'O resultado sugere sinais de apreensão. Respirar devagar pode ser um bom próximo passo.',
      dicas: [
        'Olhe ao redor e diga mentalmente 5 coisas que você consegue ver. Isso traz a atenção para o agora.',
        'Solte o ar bem devagar, como se fosse apagar uma vela de longe. Repita algumas vezes.',
        'Se algo estiver te preocupando, escreva em uma frase. Ver no papel ajuda a pensar com mais clareza.',
      ],
    },
    disgusted: {
      abertura: 'Durante o scan, sua expressão mostrou sinais de desconforto. O resultado sugere que uma pequena pausa pode cair bem.',
      dicas: [
        'Se puder, mude de lugar por alguns minutos — um pouco de ar fresco ajuda a recomeçar.',
        'Beba um copo de água e solte os ombros. Pequenas pausas fazem diferença.',
        'Faça algo simples de que você gosta: ouvir uma música, comer algo gostoso ou conversar com alguém.',
      ],
    },
  };

  /* ── AUTOAVALIAÇÃO ("Como você se sente agora?") ───────────────
     Resposta da própria pessoa, de 1 a 5, antes do scan (a) e depois
     do VR (d). Opcional: quem prefere não responder fica sem o campo. */
  const ESCALA = {
    1: 'Muito mal',
    2: 'Mal',
    3: 'Mais ou menos',
    4: 'Bem',
    5: 'Muito bem',
  };

  /** Só aceita os inteiros 1 a 5; qualquer outra coisa vira null. */
  function nivel(v) {
    return /^[1-5]$/.test(String(v ?? '')) ? Number(v) : null;
  }

  /**
   * Texto da comparação antes → depois. Fala só da resposta da pessoa:
   * não afirma que o VR causou a mudança.
   */
  function comparar(antes, depois) {
    if (antes === null && depois === null) return null;
    if (depois === null) {
      return { diff: null, texto: 'Faça o laboratório VR e responda de novo no final para comparar.' };
    }
    if (antes === null) {
      return { diff: null, texto: 'Você não respondeu antes do scan, então não há comparação desta vez.' };
    }
    const diff = depois - antes;
    const pontos = n => n === 1 ? '1 ponto' : `${n} pontos`;
    let texto;
    if (diff > 0)      texto = `Sua autoavaliação subiu ${pontos(diff)} depois da respiração guiada.`;
    else if (diff < 0) texto = `Sua autoavaliação ficou ${pontos(-diff)} abaixo de antes. Tudo bem: cada momento é diferente, e uma pausa curta nem sempre muda como a gente se sente.`;
    else               texto = 'Sua autoavaliação ficou igual antes e depois da experiência.';
    return { diff, texto };
  }

  /* ── CALIBRAÇÃO DO SCAN (usada pelo js/scan.js e explicada em js/explicacao.js) ─
     Com o rosto em repouso, o modelo tende a marcar "neutral". Ajustado na feira. */
  const CALIBRACAO = {
    AMOSTRAS:      5,    // média das últimas 5 leituras (uma a cada 200 ms)
    NEUTRO_MIN:    70,   // neutro só fica em destaque com 70% ou mais
    OUTRA_MIN:     15,   // abaixo disso, outra expressão assume com 15% ou mais
    PESO_OUTRAS:   1.5,  // peso extra das outras expressões só para ORDENAR
  };

  /**
   * A calibração mudou o destaque? Verdadeiro quando outra expressão tem
   * porcentagem maior que a do destaque (ex.: Feliz 22% em destaque, neutro 62%).
   */
  function destaquePelaCalibracao(emotions) {
    if (!emotions || emotions.length < 2) return false;
    return emotions.slice(1).some(e => e.pct > emotions[0].pct);
  }

  /** Resultado → texto da query string (sem o "?"). */
  function codificar({ emotions, manual, timestamp, antes, depois, leituras }) {
    const e = emotions.slice(0, 7)
      .map(x => `${x.key}:${Math.round(x.pct)}`)
      .join(',');
    const t = timestamp instanceof Date ? timestamp.getTime() : Date.now();
    let qs = `e=${e}&m=${manual ? 1 : 0}&t=${t}`;
    if (nivel(antes))  qs += `&a=${antes}`;
    if (nivel(depois)) qs += `&d=${depois}`;
    if (/^[1-9]$/.test(String(leituras ?? ''))) qs += `&n=${leituras}`;
    return qs;
  }

  /**
   * Query string → resultado, ou null se não houver dados válidos.
   * Só aceita as 7 chaves conhecidas e porcentagens de 0 a 100: o que vier
   * na URL nunca vira HTML.
   */
  function decodificar(search) {
    const p = new URLSearchParams(search);
    const emotions = String(p.get('e') || '').split(',')
      .map(par => {
        const [key, pct] = par.split(':');
        const n = Math.round(Number(pct));
        if (!EMOCOES[key] || !Number.isFinite(n)) return null;
        return { key, name: EMOCOES[key], pct: Math.max(0, Math.min(100, n)) };
      })
      .filter(Boolean)
      .filter((x, i, arr) => arr.findIndex(y => y.key === x.key) === i)
      .slice(0, 7);
    if (!emotions.length) return null;

    const t = Number(p.get('t'));
    return {
      emotions,
      dominant:  emotions[0].key,
      manual:    p.get('m') === '1',
      timestamp: Number.isFinite(t) && t > 0 ? new Date(t) : null,
      antes:     nivel(p.get('a')),
      depois:    nivel(p.get('d')),
      leituras:  /^[1-9]$/.test(p.get('n') || '') ? Number(p.get('n')) : null,
    };
  }

  return { EMOCOES, MODELO, destaquePelaCalibracao, COMENTARIOS, COMENTARIOS_MANUAL, RELATORIO, ESCALA, CALIBRACAO,
           nivel, comparar, codificar, decodificar };
})();
