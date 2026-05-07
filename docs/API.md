# WebP Forge API Documentation

Complete REST API reference for WebP Forge image conversion service.

## Base URL
```
http://localhost:3000
```

## Endpoints

### 1. Convert Images

**POST** `/api/convert`

Convert one or multiple images to WebP format.

#### Request

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `images` | file[] | Yes | - | Image files to convert (JPG, PNG, GIF, BMP, TIFF, DNG, HEIC, HEIF) |
| `quality` | number | No | 82 | WebP quality (1-100) |
| `lossless` | string | No | "false" | Enable lossless compression ("true"/"false") |
| `effort` | number | No | 4 | Compression effort (0-6, higher = smaller file, slower) |
| `resize` | string | No | - | JSON string: `{"width":1920,"height":1080,"fit":"inside"}` |

#### Response

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
      "originalName": "photo.jpg",
      "convertedName": "abc123.webp",
      "downloadUrl": "/api/download/abc123.webp",
      "previewUrl": "/api/preview/abc123.webp",
      "originalSizeFmt": "1.41 MB",
      "convertedSizeFmt": "380.3 KB",
      "savingsPercent": 73.7,
      "width": 1920,
      "height": 1280
    }
  ]
}
```

#### Examples

**cURL - Single File:**
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "images=@photo.jpg" \
  -F "quality=85"
```

**cURL - Multiple Files with Resize:**
```bash
curl -X POST http://localhost:3000/api/convert \
  -F "images=@img1.jpg" \
  -F "images=@img2.png" \
  -F "images=@img3.heic" \
  -F "quality=82" \
  -F 'resize={"width":1920,"height":1080,"fit":"inside"}'
```

**JavaScript:**
```javascript
const formData = new FormData();
formData.append('images', fileInput.files[0]);
formData.append('quality', '85');

const response = await fetch('http://localhost:3000/api/convert', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.results);
```

**Python:**
```python
import requests

files = [('images', open('photo.jpg', 'rb'))]
data = {'quality': '85'}

response = requests.post('http://localhost:3000/api/convert', 
                        files=files, data=data)
result = response.json()
```

---

### 2. Download Converted File

**GET** `/api/download/:filename`

Download a single converted WebP file.

#### Parameters
- `filename` (path): The converted file name from the conversion response

#### Example
```bash
curl -O http://localhost:3000/api/download/abc123.webp
```

---

### 3. Download Batch ZIP

**GET** `/api/download-zip`

Download multiple converted files as a ZIP archive.

#### Query Parameters
- `files` (string): Comma-separated list of filenames

#### Example
```bash
curl -O http://localhost:3000/api/download-zip?files=a.webp,b.webp,c.webp
```

---

### 4. Preview Image

**GET** `/api/preview/:filename`

View a converted image in the browser.

#### Parameters
- `filename` (path): The converted file name

#### Example
```
http://localhost:3000/api/preview/abc123.webp
```

---

### 5. Health Check

**GET** `/api/health`

Check server status and Sharp library version.

#### Response
```json
{
  "status": "ok",
  "sharpVersion": "0.34.5"
}
```

---

### 6. API Documentation

**GET** `/api/docs`

Get complete API reference as JSON.

---

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - File not found
- `500` - Server error

Error response format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production use, consider adding rate limiting middleware.

---

## File Cleanup

Uploaded and converted files are automatically deleted after 1 hour to save disk space.

---

## Supported Image Formats

### Input Formats
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)
- TIFF (.tiff, .tif)
- DNG (.dng)
- HEIC (.heic)
- HEIF (.heif)

### Output Format
- WebP (.webp)

---

## Best Practices

1. **Quality Settings:**
   - Use 80-85 for photos (good balance)
   - Use 90-95 for graphics with text
   - Use lossless for images requiring perfect quality

2. **Resize Options:**
   - Always use `"fit":"inside"` to prevent upscaling
   - Specify only width or height to maintain aspect ratio

3. **Batch Processing:**
   - Process up to 100 files per request
   - Use ZIP download for multiple files

4. **Error Handling:**
   - Always check the `status` field in results array
   - Handle individual file failures gracefully

---

## Integration Examples

### CI/CD Pipeline (GitHub Actions)
```yaml
- name: Convert images to WebP
  run: |
    curl -X POST http://localhost:3000/api/convert \
      -F "images=@assets/hero.jpg" \
      -F "quality=85" \
      -o result.json
```

### Node.js Script
```javascript
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function convertToWebP(filePath) {
  const form = new FormData();
  form.append('images', fs.createReadStream(filePath));
  form.append('quality', '85');
  
  const response = await axios.post('http://localhost:3000/api/convert', form, {
    headers: form.getHeaders()
  });
  
  return response.data;
}
```

---

For more information, visit: https://github.com/sujayshah3011/WebP
