import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false

let transcriber = null
let currentModel = null

self.addEventListener('message', async ({ data }) => {
  const { type, audio, model, language } = data

  if (type === 'load') {
    if (transcriber && currentModel === model) {
      self.postMessage({ type: 'loaded' })
      return
    }
    try {
      transcriber = await pipeline(
        'automatic-speech-recognition',
        model,
        {
          progress_callback: (p) => {
            if (p.status === 'progress') {
              self.postMessage({ type: 'progress', file: p.file, loaded: p.loaded, total: p.total })
            }
          }
        }
      )
      currentModel = model
      self.postMessage({ type: 'loaded' })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message })
    }
  }

  if (type === 'transcribe') {
    try {
      // language === null means auto-detect (don't pass language to Whisper)
      const opts = {
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true
      }
      if (language) opts.language = language

      const result = await transcriber(audio, opts)
      self.postMessage({ type: 'result', text: result.text, chunks: result.chunks })
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message })
    }
  }
})
