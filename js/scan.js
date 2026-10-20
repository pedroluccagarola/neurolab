/* ═══════════════════════════════════════════════════════════════════
   NEURO LAB — js/scan.js  (versão demo, sem servidor)
   Detecção de expressão facial com face-api.js, 100% no navegador.

   PRIVACIDADE:
     Os quadros da webcam vão só para o face-api.js, que roda aqui mesmo
     (TensorFlow.js na placa de vídeo). Nenhuma imagem é desenhada em
     canvas para exportar, salva ou enviada pela rede: o único resultado
     guardado são as porcentagens das 7 emoções.

   MODELOS (pasta models/, carregados uma vez):
     tiny_face_detector — encontra o rosto
     face_expression    — estima as 7 expressões

   DIFERENÇAS PARA A VERSÃO DA FEIRA (versao-feira/scan.js):
     - A câmera só abre quando a pessoa clica em INICIAR SCAN e é
       desligada logo depois da captura (na feira ela ficava sempre ligada).
     - Sem rosto detectado, captureResult() devolve null em vez de um
       resultado simulado: a demo nunca mostra números inventados.

   API (escopo global NLScan):
     NLScan.carregarModelos() — Promise<boolean>
     NLScan.abrirCamera()     — Promise<boolean> (pede permissão)
     NLScan.fecharCamera()    — desliga a webcam (a luz da câmera apaga)
     NLScan.startDetection(cb)/stopDetection()
     NLScan.captureResult()   — Promise<{emotions, comment, isReal} | null>
   ═══════════════════════════════════════════════════════════════════ */

const NLScan = (() => {

  /* ── CONFIGURAÇÃO ─────────────────────────────────────────────── */
  const CONFIG = {
    MODEL_URL: 'models',

    // Intervalo do loop de detecção em milissegundos
    DETECTION_INTERVAL_MS: 200,

    // tinyFaceDetector é o mais rápido; roda bem até em celular
    DETECTOR_OPTIONS: new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,      // 160 | 224 | 320 — maior = mais preciso, mais lento
      scoreThreshold: 0.4, // confiança mínima para considerar um rosto
    }),

    // Número de amostras acumuladas para média suavizada
    SMOOTHING_SAMPLES: 5,

    // ── Calibração da emoção neutra (ajustada na feira) ─────────
    // O modelo tende a dar "neutral" alto para rostos em repouso. O boost
    // vale só para ORDENAR: as porcentagens exibidas são as reais.
    SENSITIVITY_BOOST: 1.5,
    BOOSTED_EMOTIONS: new Set(['happy','sad','angry','fearful','disgusted','surprised']),

    // Neutral só fica em primeiro se passar de 70%. Abaixo disso, uma
    // emoção com pelo menos 15% assume o destaque.
    // Ex.: neutral=0.62, happy=0.22 → happy vence
    //      neutral=0.85, happy=0.08 → neutral vence
    NEUTRAL_DOMINANCE_THRESHOLD: 0.70,
    SECONDARY_MIN_PCT: 15,
  };

  /* ── ESTADO INTERNO ───────────────────────────────────────────── */
  let _videoEl       = null;
  let _stream        = null;
  let _detectionLoop = null;
  let _modelsLoaded  = false;
  let _modelsPromise = null;
  let _sampleBuffer  = [];     // últimas detecções, para a média suavizada
  let _onLiveUpdate  = null;

  /* ── HELPERS ──────────────────────────────────────────────────── */

  function _label(key) { return NL_DADOS.EMOCOES[key] || key; }

  /** Expressões do face-api → [{key, name, raw, pct}] ordenado. */
  function _parseExpressions(expressions) {
    const arr = Object.entries(expressions)
      .map(([key, val]) => ({
        key,
        name:    _label(key),
        raw:     val,
        pct:     Math.round(val * 100),
        sortKey: CONFIG.BOOSTED_EMOTIONS.has(key) ? val * CONFIG.SENSITIVITY_BOOST : val,
      }))
      .sort((a, b) => b.sortKey - a.sortKey);

    return _applyNeutralThreshold(arr);
  }

  /** Média das amostras do buffer, no mesmo formato de _parseExpressions. */
  function _getSmoothedEmotions() {
    if (_sampleBuffer.length === 0) return null;

    const sums = {};
    _sampleBuffer.forEach(sample => {
      sample.forEach(e => { sums[e.key] = (sums[e.key] || 0) + e.raw; });
    });

    const n = _sampleBuffer.length;
    const arr = Object.entries(sums)
      .map(([key, total]) => {
        const avg = total / n;
        return {
          key,
          name:    _label(key),
          raw:     avg,
          pct:     Math.round(avg * 100),
          sortKey: CONFIG.BOOSTED_EMOTIONS.has(key) ? avg * CONFIG.SENSITIVITY_BOOST : avg,
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey);

    return _applyNeutralThreshold(arr);
  }

  /**
   * Se neutral lidera abaixo do limiar e outra emoção tem pct suficiente,
   * essa emoção passa para o primeiro lugar. Só muda a ordem, nunca os valores.
   */
  function _applyNeutralThreshold(sorted) {
    if (sorted.length === 0) return sorted;
    const top = sorted[0];
    if (top.key !== 'neutral') return sorted;
    if (top.raw >= CONFIG.NEUTRAL_DOMINANCE_THRESHOLD) return sorted;

    const challenger = sorted.find(e => e.key !== 'neutral' && e.pct >= CONFIG.SECONDARY_MIN_PCT);
    if (!challenger) return sorted;

    const rest = sorted.filter(e => e.key !== challenger.key && e.key !== 'neutral');
    return [challenger, top, ...rest];
  }

  async function _detectarMelhorRosto() {
    const detections = await faceapi
      .detectAllFaces(_videoEl, CONFIG.DETECTOR_OPTIONS)
      .withFaceExpressions();
    if (detections.length === 0) return null;
    // Rosto com maior confiança
    return detections.reduce((a, b) => (a.detection.score > b.detection.score ? a : b));
  }

  /* ── API PÚBLICA ──────────────────────────────────────────────── */

  /** Carrega os dois modelos (≈ 520 KB, uma vez por visita). */
  function carregarModelos() {
    if (!_modelsPromise) {
      _modelsPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.MODEL_URL),
      ]).then(() => {
        _modelsLoaded = true;
        console.log('[NLScan] Modelos carregados.');
        return true;
      }).catch(err => {
        console.error('[NLScan] Erro ao carregar modelos:', err);
        _modelsPromise = null; // permite tentar de novo
        return false;
      });
    }
    return _modelsPromise;
  }

  /**
   * Pede a câmera frontal e mostra o vídeo no HUD.
   * Retorna false se a pessoa negar, se não houver câmera ou se a página
   * não estiver em contexto seguro (https ou localhost).
   */
  async function abrirCamera({ videoId = 'videoFeed', placeholderId = 'camPlaceholder' } = {}) {
    if (_stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn('[NLScan] getUserMedia indisponível (a página precisa de https).');
      return false;
    }
    _videoEl = document.getElementById(videoId);
    try {
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      _videoEl.srcObject = _stream;
      await new Promise(resolve => {
        if (_videoEl.readyState >= 1) resolve();
        else _videoEl.onloadedmetadata = resolve;
      });
      await _videoEl.play();
      _videoEl.style.display = 'block';
      const placeholder = document.getElementById(placeholderId);
      if (placeholder) placeholder.style.display = 'none';
      console.log('[NLScan] Câmera ligada.');
      return true;
    } catch (err) {
      console.warn('[NLScan] Câmera indisponível:', err.name, err.message);
      fecharCamera();
      return false;
    }
  }

  /** Desliga a webcam e volta o placeholder animado. */
  function fecharCamera({ placeholderId = 'camPlaceholder' } = {}) {
    stopDetection();
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
      console.log('[NLScan] Câmera desligada.');
    }
    if (_videoEl) {
      _videoEl.srcObject = null;
      _videoEl.style.display = 'none';
    }
    const placeholder = document.getElementById(placeholderId);
    if (placeholder) placeholder.style.display = 'block';
  }

  /** Loop de detecção contínua (alimenta a média e o contador de FPS). */
  function startDetection(onLiveUpdate = null) {
    if (_detectionLoop) return;
    if (!_modelsLoaded || !_stream) {
      console.warn('[NLScan] startDetection() chamado sem modelos ou câmera.');
      return;
    }
    _onLiveUpdate = onLiveUpdate;
    _sampleBuffer = [];
    let ocupado = false; // no celular uma detecção pode passar de 200 ms

    _detectionLoop = setInterval(async () => {
      if (ocupado) return;
      ocupado = true;
      try {
        const best = await _detectarMelhorRosto();
        if (!best) return;
        const parsed = _parseExpressions(best.expressions);
        _sampleBuffer.push(parsed);
        if (_sampleBuffer.length > CONFIG.SMOOTHING_SAMPLES) _sampleBuffer.shift();
        if (_onLiveUpdate) _onLiveUpdate(parsed);
      } catch (err) {
        console.debug('[NLScan] Loop error (ignorado):', err.message);
      } finally {
        ocupado = false;
      }
    }, CONFIG.DETECTION_INTERVAL_MS);
  }

  function stopDetection() {
    if (_detectionLoop) {
      clearInterval(_detectionLoop);
      _detectionLoop = null;
    }
  }

  /** Há pelo menos uma detecção de rosto no buffer? */
  function temRosto() { return _sampleBuffer.length > 0; }

  /**
   * Resultado final: média das últimas detecções + uma detecção extra.
   * Retorna null se nenhum rosto foi visto (o HUD pede para tentar de novo).
   */
  async function captureResult() {
    if (!_modelsLoaded || !_stream) return null;

    try {
      const best = await _detectarMelhorRosto();
      if (best) _sampleBuffer.push(_parseExpressions(best.expressions));
    } catch (err) {
      console.warn('[NLScan] Erro na detecção de captura:', err.message);
    }

    const smoothed = _getSmoothedEmotions();
    if (!smoothed) return null;

    const dominant = smoothed[0].key;
    return {
      emotions:  smoothed.slice(0, 3).map(({ key, name, pct }) => ({ key, name, pct })),
      dominant,
      comment:   NL_DADOS.COMENTARIOS[dominant] || NL_DADOS.COMENTARIOS.neutral,
      isReal:    true,
      manual:    false,
      timestamp: new Date(),
    };
  }

  return {
    carregarModelos, abrirCamera, fecharCamera,
    startDetection, stopDetection, temRosto, captureResult,
  };

})();
