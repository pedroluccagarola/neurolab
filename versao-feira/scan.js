/* ═══════════════════════════════════════════════════════════════════
   NEURO LAB — scan.js  v2.0
   Fase 2: detecção emocional real via Face-api.js

   DEPENDÊNCIAS (já incluídas no index.html via CDN):
     - face-api.js  (tinyFaceDetector + faceExpressionNet)

   MODELOS NECESSÁRIOS (baixar em /models):
     Copie esta pasta para dentro do seu projeto:
     https://github.com/vladmandic/face-api/tree/master/model
     Arquivos obrigatórios:
       models/tiny_face_detector_model-weights_manifest.json
       models/tiny_face_detector_model-shard1
       models/face_expression_model-weights_manifest.json
       models/face_expression_model-shard1

   INTERFACE COM O HUD (index.html):
     Este módulo exporta para o escopo global:
       NLScan.init()          — carrega modelos + abre câmera
       NLScan.startDetection()— inicia loop de detecção (chame ao iniciar scan)
       NLScan.stopDetection() — para o loop
       NLScan.getLastResult() — retorna o último resultado capturado
       NLScan.captureResult() — tira um "snapshot" das emoções instantâneas

   COMO INTEGRAR AO FLUXO EXISTENTE:
     1. No boot, substitua tryWebcam() por NLScan.init()
     2. Dentro de startScan(), após o countdown, chame NLScan.captureResult()
        em vez de showResult() com dados mock.
     3. captureResult() chama showResult(emotions) com dados reais.
   ═══════════════════════════════════════════════════════════════════ */

const NLScan = (() => {

  /* ── CONFIGURAÇÃO ─────────────────────────────────────────────── */
  const CONFIG = {
    // Caminho para os modelos. Se o servidor está na raiz: './models'
    MODEL_URL: './models',

    // Intervalo do loop de detecção em milissegundos
    DETECTION_INTERVAL_MS: 200,

    // Opções do detector de rosto (tinyFaceDetector é o mais rápido)
    DETECTOR_OPTIONS: new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,      // 160 | 224 | 320 — maior = mais preciso, mais lento
      scoreThreshold: 0.4, // confiança mínima para considerar um rosto
    }),

    // Número de amostras acumuladas para média suavizada no loop
    SMOOTHING_SAMPLES: 5,

    // Fator de boost aplicado às emoções não-neutras APENAS para ordenação.
    // Não altera os valores exibidos (pct) — só ajuda expressões sutis a
    // vencer o "neutral" que o modelo favorece em rostos em repouso.
    // 1.0 = sem boost (comportamento original)
    // 1.5 = boost conservador — só vira o dominante quando neutral e outra
    //       emoção estão muito próximos (diferença < ~30 pontos percentuais)
    SENSITIVITY_BOOST: 1.5,

    // Emoções que recebem boost (todas exceto neutral)
    BOOSTED_EMOTIONS: new Set(['happy','sad','angry','fearful','disgusted','surprised']),

    // Limiar máximo de neutral para ele ser considerado dominante.
    // Se neutral < este valor E outra emoção tiver pct >= SECONDARY_MIN_PCT,
    // a emoção não-neutra vence — mesmo que neutral seja numericamente maior.
    // Exemplo: neutral=0.62, happy=0.22 → happy vence (neutral abaixo do limiar)
    // Exemplo: neutral=0.85, happy=0.08 → neutral vence (neutral acima do limiar)
    // 0.70 = limiar conservador. Aumente para 0.75 se quiser mais sensibilidade.
    NEUTRAL_DOMINANCE_THRESHOLD: 0.70,

    // Percentual mínimo que a emoção não-neutra precisa ter para vencer neutral
    // Evita que ruído (0.01, 0.02) seja promovido a dominante
    SECONDARY_MIN_PCT: 15,

    // Mapeamento de nomes internos (inglês) → português
    EMOTION_LABELS: {
      happy:     'Feliz',
      sad:       'Triste',
      angry:     'Irritado',
      fearful:   'Apreensivo',
      disgusted: 'Incomodado',
      surprised: 'Surpreso',
      neutral:   'Tranquilo',
    },

    // Comentários da IA por perfil emocional dominante.
    // Tom do api/fallback.json: simples, acolhedor, sem termos técnicos e
    // sem afirmar o que a pessoa sente (fala de sinais na expressão).
    AI_COMMENTS: {
      happy:     'Durante o scan, sua expressão mostrou sinais de alegria. Que bom começar a experiência assim.',
      sad:       'O resultado sugere um momento de reflexão. A respiração guiada no VR pode ser uma boa pausa para você.',
      angry:     'Durante o scan, sua expressão mostrou sinais de tensão. Na próxima etapa, vamos respirar com calma, sem pressa.',
      fearful:   'O resultado sugere sinais de apreensão. Na próxima etapa, vamos respirar juntos, no seu ritmo.',
      disgusted: 'Durante o scan, sua expressão mostrou sinais de desconforto. Uma pausa para respirar pode ajudar.',
      surprised: 'Durante o scan, sua expressão mostrou sinais de surpresa. Um ótimo jeito de começar algo novo.',
      neutral:   'Durante o scan, sua expressão mostrou sinais de tranquilidade. Um bom ponto de partida para o que vem a seguir.',
    },
  };

  /* ── ESTADO INTERNO ───────────────────────────────────────────── */
  let _videoEl       = null;   // elemento <video>
  let _overlayCanvas = null;   // canvas de debug (opcional)
  let _overlayCtx    = null;
  let _detectionLoop = null;   // ID do setInterval
  let _modelsLoaded  = false;
  let _cameraActive  = false;

  // Buffer circular para suavização das emoções
  let _sampleBuffer  = [];     // Array de objetos {emotions}

  // Último resultado processado (disponível para qualquer parte do app)
  let _lastResult    = null;

  // Callback chamado a cada frame com dados ao vivo (para atualizar barras idle)
  let _onLiveUpdate  = null;

  // Callback chamado quando captureResult() processa um snapshot
  let _onCapture     = null;

  /* ── HELPERS ──────────────────────────────────────────────────── */

  /**
   * Converte o objeto de expressões do Face-api em array ordenado
   * [{name, raw, pct}, ...] do maior para o menor
   */
  function _parseExpressions(expressions) {
    const arr = Object.entries(expressions)
      .map(([key, val]) => ({
        key,
        name:    CONFIG.EMOTION_LABELS[key] || key,
        raw:     val,
        pct:     Math.round(val * 100),
        sortKey: CONFIG.BOOSTED_EMOTIONS.has(key)
          ? val * CONFIG.SENSITIVITY_BOOST
          : val,
      }))
      .sort((a, b) => b.sortKey - a.sortKey);

    return _applyNeutralThreshold(arr);
  }

  /**
   * Média suavizada do buffer de amostras.
   * Retorna o mesmo formato de _parseExpressions.
   */
  function _getSmoothedEmotions() {
    if (_sampleBuffer.length === 0) return null;

    const sums = {};
    _sampleBuffer.forEach(sample => {
      sample.forEach(e => {
        sums[e.key] = (sums[e.key] || 0) + e.raw;
      });
    });

    const n = _sampleBuffer.length;
    const arr = Object.entries(sums)
      .map(([key, total]) => {
        const avg = total / n;
        return {
          key,
          name:    CONFIG.EMOTION_LABELS[key] || key,
          raw:     avg,
          pct:     Math.round(avg * 100),
          sortKey: CONFIG.BOOSTED_EMOTIONS.has(key)
            ? avg * CONFIG.SENSITIVITY_BOOST
            : avg,
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey);

    return _applyNeutralThreshold(arr);
  }

  /**
   * _applyNeutralThreshold()
   * Se neutral está abaixo do NEUTRAL_DOMINANCE_THRESHOLD E existe uma
   * emoção não-neutra com pct >= SECONDARY_MIN_PCT, move neutral para
   * segunda posição e promove a emoção não-neutra mais alta.
   *
   * Os valores (raw, pct) NÃO são alterados — apenas a posição no array.
   * Isso garante que o visitante vê os percentuais reais, mas a emoção
   * exibida em destaque reflete melhor expressões sutis.
   */
  function _applyNeutralThreshold(sorted) {
    if (sorted.length === 0) return sorted;

    const top = sorted[0];

    // Só aplica se neutral é o primeiro
    if (top.key !== 'neutral') return sorted;

    // Se neutral está acima do limiar, ele domina de verdade — não muda nada
    if (top.raw >= CONFIG.NEUTRAL_DOMINANCE_THRESHOLD) return sorted;

    // Procura a emoção não-neutra mais alta com pct mínimo
    const challenger = sorted.find(e =>
      e.key !== 'neutral' && e.pct >= CONFIG.SECONDARY_MIN_PCT
    );

    if (!challenger) return sorted; // não há candidata forte o suficiente

    // Reordena: challenger primeiro, neutral segundo, resto igual
    const reordered = sorted.filter(e => e.key !== challenger.key && e.key !== 'neutral');
    return [challenger, top, ...reordered];
  }

  /**
   * Gera o comentário da IA baseado na emoção dominante
   */
  function _generateComment(emotions) {
    if (!emotions || emotions.length === 0) return 'Análise concluída.';
    const dominant = emotions[0].key;
    return CONFIG.AI_COMMENTS[dominant] || CONFIG.AI_COMMENTS.neutral;
  }

  /**
   * Atualiza as barras "ao vivo" no HUD durante o loop idle
   * (opcional — mostra que a câmera está processando mesmo antes do scan)
   */
  function _updateLiveBars(emotions) {
    if (!emotions || !_onLiveUpdate) return;
    _onLiveUpdate(emotions);
  }

  /**
   * Desenha caixas de debug sobre o vídeo (ative em DEV_MODE)
   */
  function _drawDebugOverlay(detections) {
    if (!_overlayCtx || !_overlayCanvas) return;
    _overlayCtx.clearRect(0, 0, _overlayCanvas.width, _overlayCanvas.height);

    detections.forEach(det => {
      const { x, y, width, height } = det.detection.box;
      _overlayCtx.strokeStyle = '#00E5FF';
      _overlayCtx.lineWidth   = 1.5;
      _overlayCtx.strokeRect(x, y, width, height);

      // Top 3 emoções como texto
      const top3 = _parseExpressions(det.expressions).slice(0, 3);
      top3.forEach((e, i) => {
        _overlayCtx.fillStyle = '#00E5FF';
        _overlayCtx.font = '11px monospace';
        _overlayCtx.fillText(
          `${e.name} ${e.pct}%`,
          x + 4,
          y - 6 + (i * -16)
        );
      });
    });
  }

  /* ── API PÚBLICA ──────────────────────────────────────────────── */

  /**
   * init()
   * Carrega os modelos do Face-api e abre a câmera.
   * Deve ser chamado no boot, substituindo tryWebcam().
   *
   * @param {Object} opts
   * @param {string} opts.videoId       — id do elemento <video> (padrão: 'videoFeed')
   * @param {string} opts.placeholderId — id do canvas placeholder (padrão: 'camPlaceholder')
   * @param {string} opts.statusId      — id do span de status da câmera (padrão: 'camStatus')
   * @param {string} opts.aiStatusId    — id do span de status da IA (padrão: 'aiStatus')
   * @param {string} opts.labelId       — id do label scanner (padrão: 'scannerLabel')
   * @param {boolean} opts.debugOverlay — mostrar caixa de detecção (padrão: false)
   * @returns {Promise<boolean>} true se tudo carregou, false se algum erro
   */
  async function init(opts = {}) {
    const {
      videoId       = 'videoFeed',
      placeholderId = 'camPlaceholder',
      statusId      = 'camStatus',
      aiStatusId    = 'aiStatus',
      labelId       = 'scannerLabel',
      debugOverlay  = false,
    } = opts;

    const camStatusEl = document.getElementById(statusId);
    const aiStatusEl  = document.getElementById(aiStatusId);
    const labelEl     = document.getElementById(labelId);

    // ── 1. Carregar modelos ────────────────────────────────────────
    try {
      if (aiStatusEl) aiStatusEl.textContent = 'CARREGANDO...';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.MODEL_URL),
      ]);

      _modelsLoaded = true;
      if (aiStatusEl) aiStatusEl.textContent = 'PRONTO';
      console.log('[NLScan] Modelos carregados com sucesso.');

    } catch (err) {
      console.error('[NLScan] Erro ao carregar modelos:', err);
      if (aiStatusEl) aiStatusEl.textContent = 'ERRO MODELO';
      // Continua sem detecção — experiência degradada mas não quebrada
      _modelsLoaded = false;
    }

    // ── 2. Abrir câmera ────────────────────────────────────────────
    _videoEl = document.getElementById(videoId);
    const placeholder = document.getElementById(placeholderId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width:  { ideal: 640 },
          height: { ideal: 640 },
        },
      });

      _videoEl.srcObject = stream;
      await new Promise(resolve => { _videoEl.onloadedmetadata = resolve; });
      _videoEl.play();

      _videoEl.style.display   = 'block';
      if (placeholder) placeholder.style.display = 'none';

      _cameraActive = true;
      if (camStatusEl) camStatusEl.textContent = 'ATIVA';
      if (labelEl)     labelEl.textContent      = '▸ ROSTO DETECTADO ◂';

      console.log('[NLScan] Câmera iniciada.');

    } catch (err) {
      console.warn('[NLScan] Câmera indisponível:', err.message);
      if (camStatusEl) camStatusEl.textContent = 'SIMULADO';
      _cameraActive = false;
      // placeholder animado continua no lugar — experiência visual mantida
    }

    // ── 3. Canvas de debug (opcional) ─────────────────────────────
    if (debugOverlay && _cameraActive) {
      _overlayCanvas = document.createElement('canvas');
      _overlayCanvas.style.cssText = `
        position:absolute; inset:0; width:100%; height:100%;
        z-index:7; pointer-events:none;
      `;
      document.getElementById('webcamZone').appendChild(_overlayCanvas);
      _overlayCtx = _overlayCanvas.getContext('2d');
    }

    return _modelsLoaded && _cameraActive;
  }

  /**
   * startDetection()
   * Inicia o loop de detecção contínua a cada DETECTION_INTERVAL_MS.
   * Use durante o estado idle para pré-aquecer e alimentar as barras ao vivo.
   * Chame stopDetection() quando não precisar mais.
   *
   * @param {Function} onLiveUpdate — callback(emotions[]) chamado a cada frame
   */
  function startDetection(onLiveUpdate = null) {
    if (_detectionLoop) return; // já rodando
    if (!_modelsLoaded || !_cameraActive) {
      console.warn('[NLScan] startDetection() chamado sem modelos ou câmera.');
      return;
    }

    _onLiveUpdate = onLiveUpdate;
    _sampleBuffer = [];

    _detectionLoop = setInterval(async () => {
      try {
        const detections = await faceapi
          .detectAllFaces(_videoEl, CONFIG.DETECTOR_OPTIONS)
          .withFaceExpressions();

        if (detections.length === 0) return; // nenhum rosto no frame

        // Usar o rosto mais confiante (maior bounding box)
        const best = detections.reduce((a, b) =>
          a.detection.score > b.detection.score ? a : b
        );

        const parsed = _parseExpressions(best.expressions);

        // Adicionar ao buffer circular
        _sampleBuffer.push(parsed);
        if (_sampleBuffer.length > CONFIG.SMOOTHING_SAMPLES) {
          _sampleBuffer.shift();
        }

        // Atualizar barras ao vivo
        _updateLiveBars(parsed);

        // Debug overlay
        _drawDebugOverlay(detections);

      } catch (err) {
        // Erros silenciosos no loop — não travar a UI
        console.debug('[NLScan] Loop error (ignorado):', err.message);
      }
    }, CONFIG.DETECTION_INTERVAL_MS);

    console.log('[NLScan] Loop de detecção iniciado.');
  }

  /**
   * stopDetection()
   * Para o loop. Chame antes de tirar um snapshot ou ao sair.
   */
  function stopDetection() {
    if (_detectionLoop) {
      clearInterval(_detectionLoop);
      _detectionLoop = null;
      console.log('[NLScan] Loop de detecção parado.');
    }
  }

  /**
   * captureResult()
   * Tira um snapshot IMEDIATO das emoções — para usar no momento do scan.
   * Para câmera indisponível, retorna resultado simulado.
   *
   * @param {Function} callback — função(result) chamada com o resultado
   *   result = { emotions: [{name, pct, key}], comment: string, isReal: boolean }
   */
  async function captureResult(callback) {
    // ── Sem câmera ou modelos: resultado simulado ──────────────────
    if (!_modelsLoaded || !_cameraActive) {
      const simulated = _getSimulatedResult();
      _lastResult = simulated;
      if (callback) callback(simulated);
      return simulated;
    }

    // ── Com câmera: usa a média suavizada do buffer ─────────────────
    // Tenta uma última detecção síncrona para frescura máxima
    let emotions = null;
    try {
      const detections = await faceapi
        .detectAllFaces(_videoEl, CONFIG.DETECTOR_OPTIONS)
        .withFaceExpressions();

      if (detections.length > 0) {
        const best = detections.reduce((a, b) =>
          a.detection.score > b.detection.score ? a : b
        );
        emotions = _parseExpressions(best.expressions);

        // Adicionar ao buffer para a média final
        _sampleBuffer.push(emotions);
      }
    } catch (err) {
      console.warn('[NLScan] Erro na detecção de captura:', err.message);
    }

    // Usar média suavizada se tiver amostras, senão a última detecção
    const smoothed = _getSmoothedEmotions() || emotions;

    if (!smoothed) {
      // Buffer vazio (ninguém na câmera) — simular
      const simulated = _getSimulatedResult();
      _lastResult = simulated;
      if (callback) callback(simulated);
      return simulated;
    }

    const result = {
      emotions: smoothed.slice(0, 3), // top 3
      comment:  _generateComment(smoothed),
      isReal:   true,
      timestamp: new Date(),
    };

    _lastResult = result;
    if (callback) callback(result);
    return result;
  }

  /**
   * getLastResult()
   * Retorna o último resultado processado (para qualquer componente que precise).
   */
  function getLastResult() {
    return _lastResult;
  }

  /**
   * _getSimulatedResult()
   * Fallback quando a câmera não está disponível.
   * Mantém a experiência visual intacta.
   */
  function _getSimulatedResult() {
    // Somam no máximo 100%, como as probabilidades reais do face-api.
    // Tranquilo só lidera com >= 70% (NEUTRAL_DOMINANCE_THRESHOLD).
    const SIMULATED_SETS = [
      [
        { key:'neutral',   name:'Tranquilo',  raw:.74, pct:74 },
        { key:'happy',     name:'Feliz',       raw:.16, pct:16 },
        { key:'surprised', name:'Surpreso',    raw:.06, pct:6  },
      ],
      [
        { key:'happy',     name:'Feliz',       raw:.70, pct:70 },
        { key:'surprised', name:'Surpreso',    raw:.18, pct:18 },
        { key:'neutral',   name:'Tranquilo',   raw:.08, pct:8  },
      ],
      [
        { key:'neutral',   name:'Tranquilo',   raw:.71, pct:71 },
        { key:'happy',     name:'Feliz',       raw:.14, pct:14 },
        { key:'fearful',   name:'Apreensivo',  raw:.09, pct:9  },
      ],
    ];
    // Varia com o tempo para não repetir sempre o mesmo
    const idx = Math.floor(Date.now() / 30000) % SIMULATED_SETS.length;
    const emotions = SIMULATED_SETS[idx];
    return {
      emotions,
      comment:  _generateComment(emotions),
      isReal:   false,
      timestamp: new Date(),
    };
  }

  // ── Expor API pública ──────────────────────────────────────────
  return { init, startDetection, stopDetection, captureResult, getLastResult };

})();
