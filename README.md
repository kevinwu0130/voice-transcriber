# 🎙 聲音轉文字

純前端 Web App，不需後端、不需 API Key，支援即時錄音轉錄與音訊檔案轉錄。

![Platform](https://img.shields.io/badge/platform-Web-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能

### 🎤 即時錄音
- 使用瀏覽器內建 **Web Speech API**（Safari on macOS 底層為 Apple 語音引擎）
- 連續錄音模式，邊說邊即時顯示文字
- 支援繁體中文、簡體中文、English、日本語
- 可複製、儲存 .txt、清除

### 📁 音訊檔案轉錄
- 使用 **Whisper.js**（@xenova/transformers），完全在瀏覽器內執行
- 拖放或點擊選擇音訊檔案
- 支援 MP3、M4A、WAV、OGG、FLAC、WebM
- 兩種模型可選：

| 模型 | 大小 | 特點 |
|------|------|------|
| Whisper Tiny | ~150 MB | 速度快，適合一般使用 |
| Whisper Base | ~290 MB | 準確率較高 |

- 支援中文、English、日本語、自動偵測
- 模型首次使用時下載，之後快取於瀏覽器，可離線使用

## 開啟方式

```bash
git clone https://github.com/kevinwu0130/voice-transcriber.git
cd voice-transcriber
npm install
npm run dev
```

瀏覽器開啟 **http://localhost:5173**

> 建議使用 **Safari**（macOS）以獲得最佳 Web Speech API 支援。

## 系統需求

| 項目 | 需求 |
|------|------|
| 瀏覽器 | Safari 14+ / Chrome 90+（即時錄音）|
| Node.js | 18 或更新版本 |
| 網路 | 首次下載 Whisper 模型時需要 |

## 專案結構

```
voice-transcriber/
├── index.html              # 主頁面
├── vite.config.js          # Vite 設定（含 COOP/COEP headers）
├── src/
│   ├── main.js             # 主邏輯（Web Speech API + 檔案轉錄 UI）
│   ├── whisper.worker.js   # Whisper 推論 Worker（避免阻塞主執行緒）
│   └── style.css           # 介面樣式
└── package.json
```

## 授權

MIT License
