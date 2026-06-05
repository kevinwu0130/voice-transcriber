import './style.css'

// ─── Tab switching ────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`panel-${btn.dataset.tab}`).classList.add('active')
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function setResult(el, text, isPlaceholder = false) {
  el.textContent = text
  el.classList.toggle('placeholder', isPlaceholder)
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  })
}

function saveText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function flashSuccess(btn, label) {
  const orig = btn.textContent
  btn.textContent = label
  btn.classList.add('success')
  setTimeout(() => { btn.textContent = orig; btn.classList.remove('success') }, 1500)
}

// ─── Live recording (Web Speech API) ─────────────────────────────────────────
;(() => {
  const recordBtn    = document.getElementById('record-btn')
  const recordStatus = document.getElementById('record-status')
  const resultBox    = document.getElementById('live-result')
  const charCount    = document.getElementById('live-char-count')
  const copyBtn      = document.getElementById('live-copy')
  const saveBtn      = document.getElementById('live-save')
  const clearBtn     = document.getElementById('live-clear')
  const langRow      = document.getElementById('live-lang-row')

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) {
    setResult(resultBox, '⚠️ 此瀏覽器不支援 Web Speech API，請改用 Safari 或 Chrome。', true)
    recordBtn.disabled = true
    return
  }

  let recognition = null
  let isRecording = false
  let finalText   = ''
  let currentLang = 'zh-TW'

  langRow.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      langRow.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentLang = btn.dataset.lang
      if (isRecording) { stopRecording(); startRecording() }
    })
  })

  function startRecording() {
    recognition = new SpeechRecognition()
    recognition.lang = currentLang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      isRecording = true
      recordBtn.classList.add('recording')
      recordBtn.textContent = '⏹'
      recordStatus.textContent = '錄音中…點擊停止'
    }

    recognition.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      // Show confirmed text + live interim
      resultBox.innerHTML = ''
      resultBox.classList.remove('placeholder')
      const confirmed = document.createTextNode(finalText)
      resultBox.appendChild(confirmed)
      if (interim) {
        const span = document.createElement('span')
        span.className = 'interim'
        span.textContent = interim
        resultBox.appendChild(span)
      }
      const total = finalText.length + interim.length
      charCount.textContent = total ? `${total} 字` : ''
    }

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        recordStatus.textContent = '⚠️ 麥克風權限被拒絕，請在瀏覽器設定中允許'
      } else if (e.error === 'no-speech') {
        recordStatus.textContent = '未偵測到聲音，請再試一次'
      } else {
        recordStatus.textContent = `錯誤：${e.error}`
      }
      stopRecording()
    }

    recognition.onend = () => {
      if (isRecording) recognition.start() // auto-restart for continuous
    }

    recognition.start()
  }

  function stopRecording() {
    isRecording = false
    if (recognition) { recognition.onend = null; recognition.stop(); recognition = null }
    recordBtn.classList.remove('recording')
    recordBtn.textContent = '🎤'
    recordStatus.textContent = '按下麥克風開始錄音'
  }

  recordBtn.addEventListener('click', () => {
    if (isRecording) stopRecording()
    else startRecording()
  })

  copyBtn.addEventListener('click', () => {
    if (!finalText.trim()) return
    copyText(finalText)
    flashSuccess(copyBtn, '✅ 已複製')
  })

  saveBtn.addEventListener('click', () => {
    if (!finalText.trim()) return
    saveText(finalText, `transcript_${Date.now()}.txt`)
  })

  clearBtn.addEventListener('click', () => {
    finalText = ''
    charCount.textContent = ''
    setResult(resultBox, '等待錄音…', true)
  })
})()

// ─── File transcription (Whisper.js) ─────────────────────────────────────────
;(() => {
  const dropZone      = document.getElementById('drop-zone')
  const fileInput     = document.getElementById('file-input')
  const fileNameEl    = document.getElementById('file-name')
  const progressWrap  = document.getElementById('progress-wrap')
  const progressLabel = document.getElementById('progress-label')
  const progressBar   = document.getElementById('progress-bar')
  const transcribeBtn = document.getElementById('transcribe-btn')
  const resultBox     = document.getElementById('file-result')
  const charCount     = document.getElementById('file-char-count')
  const copyBtn       = document.getElementById('file-copy')
  const saveBtn       = document.getElementById('file-save')
  const clearBtn      = document.getElementById('file-clear')
  const modelRow      = document.querySelector('.model-row')
  const langRow       = document.getElementById('file-lang-row')

  let selectedFile = null
  let currentModel = 'Xenova/whisper-tiny'
  let currentLang  = 'chinese'
  let worker       = null
  let workerReady  = false
  let resultText   = ''

  // Language selector
  langRow.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      langRow.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentLang = btn.dataset.lang
    })
  })

  // Model selector
  modelRow.querySelectorAll('.model-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentModel === btn.dataset.model) return
      modelRow.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      currentModel = btn.dataset.model
      workerReady = false // force reload on next transcription
      if (worker) { worker.terminate(); worker = null }
    })
  })

  // File selection
  function handleFile(file) {
    if (!file || !file.type.startsWith('audio/')) {
      alert('請選擇音訊檔案（MP3、M4A、WAV、OGG、FLAC 等）')
      return
    }
    selectedFile = file
    fileNameEl.textContent = `📄 ${file.name}  (${(file.size / 1024 / 1024).toFixed(1)} MB)`
    fileNameEl.style.display = 'block'
    transcribeBtn.disabled = false
  }

  dropZone.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]))

  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over') })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'))
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropZone.classList.remove('drag-over')
    handleFile(e.dataTransfer.files[0])
  })

  // Transcribe
  transcribeBtn.addEventListener('click', async () => {
    if (!selectedFile) return
    transcribeBtn.disabled = true
    transcribeBtn.textContent = '處理中…'
    setResult(resultBox, '正在準備音訊…', true)
    resultText = ''
    charCount.textContent = ''

    // Decode audio to Float32Array at 16 kHz
    let audioData
    try {
      const arrayBuffer = await selectedFile.arrayBuffer()
      const audioCtx = new AudioContext({ sampleRate: 16000 })
      const decoded  = await audioCtx.decodeAudioData(arrayBuffer)
      audioCtx.close()
      // Downmix to mono
      if (decoded.numberOfChannels > 1) {
        const left  = decoded.getChannelData(0)
        const right = decoded.getChannelData(1)
        audioData = new Float32Array(left.length)
        for (let i = 0; i < left.length; i++) audioData[i] = (left[i] + right[i]) / 2
      } else {
        audioData = decoded.getChannelData(0)
      }
    } catch (err) {
      setResult(resultBox, `❌ 音訊解碼失敗：${err.message}`, true)
      resetBtn(); return
    }

    // Create / reuse worker
    if (!worker) {
      worker = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' })
    }

    // Load model if needed
    if (!workerReady) {
      progressWrap.classList.add('visible')
      progressLabel.textContent = `載入 Whisper 模型 (${currentModel})…`
      progressBar.style.width = '0%'

      await new Promise((resolve, reject) => {
        const fileProgress = {}

        worker.onmessage = ({ data }) => {
          if (data.type === 'progress') {
            if (data.total > 0) {
              fileProgress[data.file] = data.loaded / data.total
              const avg = Object.values(fileProgress).reduce((a, b) => a + b, 0) / Object.keys(fileProgress).length
              progressBar.style.width = `${(avg * 100).toFixed(0)}%`
              progressLabel.textContent = `載入模型：${(avg * 100).toFixed(0)}%`
            }
          } else if (data.type === 'loaded') {
            workerReady = true
            progressBar.style.width = '100%'
            progressLabel.textContent = '模型已就緒'
            resolve()
          } else if (data.type === 'error') {
            reject(new Error(data.message))
          }
        }
        worker.postMessage({ type: 'load', model: currentModel })
      }).catch(err => {
        setResult(resultBox, `❌ 模型載入失敗：${err.message}`, true)
        workerReady = false
        resetBtn()
        return
      })
    }

    // Transcribe
    setResult(resultBox, '轉錄中，請稍候…', true)
    progressLabel.textContent = '轉錄中…'
    progressBar.style.width = '0%'

    // Animate progress bar (indeterminate feel)
    let fakeProgress = 0
    const fakeTimer = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + Math.random() * 3, 90)
      progressBar.style.width = `${fakeProgress.toFixed(0)}%`
    }, 300)

    await new Promise((resolve) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'result') {
          clearInterval(fakeTimer)
          progressBar.style.width = '100%'
          progressLabel.textContent = '轉錄完成'
          resultText = data.text.trim()
          setResult(resultBox, resultText || '（無法辨識內容）', !resultText)
          charCount.textContent = resultText ? `${resultText.length} 字` : ''
          resolve()
        } else if (data.type === 'error') {
          clearInterval(fakeTimer)
          setResult(resultBox, `❌ 轉錄失敗：${data.message}`, true)
          resolve()
        }
      }
      const lang = currentLang === 'auto' ? null : currentLang
      worker.postMessage({ type: 'transcribe', audio: audioData, language: lang })
    })

    resetBtn()
  })

  function resetBtn() {
    transcribeBtn.disabled = !selectedFile
    transcribeBtn.textContent = '開始轉錄'
  }

  copyBtn.addEventListener('click', () => {
    if (!resultText) return
    copyText(resultText)
    flashSuccess(copyBtn, '✅ 已複製')
  })

  saveBtn.addEventListener('click', () => {
    if (!resultText) return
    const name = selectedFile ? selectedFile.name.replace(/\.[^.]+$/, '') : 'transcript'
    saveText(resultText, `${name}_transcript.txt`)
  })

  clearBtn.addEventListener('click', () => {
    resultText = ''; charCount.textContent = ''
    setResult(resultBox, '選擇音訊檔案後按「開始轉錄」…', true)
    progressWrap.classList.remove('visible')
  })

  function copyText(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select()
      document.execCommand('copy'); ta.remove()
    })
  }
  function saveText(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }
  function flashSuccess(btn, label) {
    const orig = btn.textContent
    btn.textContent = label; btn.classList.add('success')
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('success') }, 1500)
  }
})()
