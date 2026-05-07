<div align="center">

# ⚡ WebP Forge

### The fastest self-hosted image → WebP converter. Drag. Drop. Done.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Powered by Sharp](https://img.shields.io/badge/Powered%20by-Sharp%20%2F%20libvips-ff6b35?style=flat-square)](https://sharp.pixelplumbing.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![GitHub Stars](https://img.shields.io/github/stars/YOUR_USERNAME/webp-forge?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME/webp-forge/stargazers)

<br/>

**Convert JPG · PNG · GIF · BMP · TIFF · DNG · HEIC → WebP**
<br/>
Bulk batch · REST API · Live preview · ZIP download · 100% local — your files never leave your server.

<br/>

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [📡 REST API](#-rest-api) · [🤝 Contributing](#-contributing)

</div>

---

## 🤔 Why WebP Forge?

Most online converters upload your photos to someone else's cloud. WebP Forge runs **entirely on your own machine or server** — no third-party uploads, no file size paywalls, no rate limits.

| | WebP Forge | CloudConvert | Squoosh |
|---|---|---|---|
| Self-hosted | ✅ | ❌ | ✅ |
| Bulk (100 files) | ✅ | 💰 Paid | ❌ |
| HEIC / HEIF support | ✅ | ✅ | ❌ |
| REST API | ✅ | 💰 Paid | ❌ |
| ZIP download | ✅ | ✅ | ❌ |
| Privacy | 🔒 100% local | ☁️ Cloud | 🔒 Local |

---

## ✨ Features

- 🖼️ **Drag & drop UI** — drop up to 100 images at once, or click to browse
- 📱 **HEIC / HEIF support** — convert iPhone photos directly, zero native dependencies
- 🔁 **Lossless & lossy** — full control over quality (1–100) and compression effort (0–6)
- 📐 **Smart resize** — max width/height with aspect ratio locked, never upscales
- 👁️ **Live before/after preview** — side-by-side original vs converted with size delta
- 📦 **Batch ZIP download** — download all converted files in one click
- 📡 **Full REST API** — curl, JS, Python, CI/CD — whatever your pipeline needs
- 🧹 **Auto cleanup** — files are wiped after 1 hour, nothing lingers on disk
- ⚡ **Sharp / libvips engine** — the fastest image processing library for Node.js

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/webp-forge.git
cd webp-forge

# 2. Install dependencies
npm install

# 3. Start
npm start

# 4. Open in browser
open http://localhost:3000
```

> **Development mode** (auto-reload):
> ```bash
> npm run dev
> ```

No Docker. No build step. No config files. Just `npm start`.

---

## 📋 Requirements

| | Version |
|---|---|
| Node.js | ≥ 18.x |
| npm | ≥ 8.x |
| OS | macOS · Linux · Windows (WSL2 recommended) |

---

## 📱 HEIC / HEIF Support

HEIC is the default photo format on every iPhone since iOS 11. WebP Forge handles it via a two-step pipeline using a pure WASM decoder — **no system libraries or native dependencies required**:

```
.heic  →  heic-convert (WASM)  →  JPEG buffer  →  Sharp  →  .webp
```

It just works after `npm install`.

---

## 📡 REST API

WebP Forge ships with a full REST API — perfect for automation, CI/CD, or integrating into your own app.

### `POST /api/convert`

| Field | Type | Default | Description |
|---|---|---|---|
| `images` | `file[]` | — | JPG · PNG · GIF · BMP · TIFF · DNG · HEIC · HEIF |
| `quality` | `1–100` | `82` | WebP quality level |
| `lossless` | `"true"/"false"` | `"false"` | Lossless compression |
| `effort` | `0–6` | `4` | Compression effort (higher = smaller, slower) |
| `resize` | JSON string | — | `{"width":1920,"height":1080,"fit":"inside"}` |

**Single file:**
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "images=@photo.jpg" \
  -F "quality=85"
```

**Bulk:**
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "images=@img1.jpg" \
  -F "images=@img2.png" \
  -F "images=@img3.heic" \
  -F "quality=82" \
  -F 'resize={"width":1920}'
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "totalOriginalSizeFmt": "4.21 MB",
  "totalConvertedSizeFmt": "1.13 MB",
  "totalSavingsPercent": 73.2,
  "batchDownloadUrl": "/api/download-zip?files=a.webp,b.webp,c.webp",
  "results": [
    {
      "status": "success",
      "originalName": "img1.jpg",
      "downloadUrl": "/api/download/abc123.webp",
      "originalSizeFmt": "1.41 MB",
      "convertedSizeFmt": "380.3 KB",
      "savingsPercent": 73.7,
      "width": 1920,
      "height": 1280
    }
  ]
}
```

### Other Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/download/:filename` | Download a converted WebP file |
| `GET` | `/api/download-zip?files=a.webp,b.webp` | Download batch as ZIP |
| `GET` | `/api/preview/:filename` | Preview image in browser |
| `GET` | `/api/health` | Server health + Sharp version |
| `GET` | `/api/docs` | Full API reference as JSON |

---

### JavaScript

```js
const form = new FormData();
files.forEach(f => form.append('images', f));
form.append('quality', '85');

const res  = await fetch('http://localhost:3000/api/convert', { method: 'POST', body: form });
const data = await res.json();

for (const r of data.results) {
  if (r.status === 'success')
    console.log(`${r.originalName}: ${r.savingsPercent}% smaller → ${r.downloadUrl}`);
}
```

### Python

```python
import requests

files = [('images', open('photo.jpg', 'rb')), ('images', open('photo.heic', 'rb'))]
resp  = requests.post('http://localhost:3000/api/convert',
                      files=files, data={'quality': '85'}).json()

for r in resp['results']:
    if r['status'] == 'success':
        content = requests.get(f"http://localhost:3000{r['downloadUrl']}").content
        open(r['convertedName'], 'wb').write(content)
        print(f"✓ {r['originalName']} → {r['convertedSizeFmt']} ({r['savingsPercent']}% saved)")
```

---

## ⚙️ Configuration

| Env Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |

```bash
PORT=8080 npm start
```

---

## 📁 Project Structure

```
webp-forge/
├── server.js        ← Express server + all API routes
├── package.json
├── public/
│   └── index.html   ← Full UI (single file, zero build step)
├── uploads/         ← Temp upload dir (auto-wiped hourly)
└── converted/       ← Temp output dir (auto-wiped hourly)
```

---

## 🤝 Contributing

Contributions are hugely appreciated. Here's how:

1. Fork the repo
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

**Ideas / open issues:**
- [ ] AVIF output format support
- [ ] Strip EXIF metadata option
- [ ] Docker image + `docker-compose.yml`
- [ ] Per-file progress bar for large batches
- [ ] Webhook callback on conversion complete

---

## 📄 License

MIT © [YOUR_USERNAME](https://github.com/YOUR_USERNAME)

See [`LICENSE`](LICENSE) for full text.

---

<div align="center">

**If WebP Forge saved you time, a ⭐ helps others find it — thank you!**

<br/>

Made with ❤️ · Powered by [Sharp](https://sharp.pixelplumbing.com) · Inspired by [CloudConvert](https://cloudconvert.com)

</div>
