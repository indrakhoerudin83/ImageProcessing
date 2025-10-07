# Mini Photoshop + AI (FastAPI)

A simple, modern web page with a FastAPI backend that accepts an image or a text prompt, calls an external AI API if configured, and falls back to a local Pillow-based mock. Includes a responsive frontend with a preview area and loading spinner.

## Features

- Frontend: HTML/CSS/JS with file upload, text prompt, responsive layout, and spinner
- Backend: FastAPI with one endpoint `/api/process`
- External AI API integration via environment variables
- Graceful fallback to local mock processing using Pillow
- Error handling for invalid inputs and API failures

## Requirements

- Python 3.9+

## Quick Start

1. Create and activate a virtual environment (recommended)

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Install dependencies

```bash
pip install -r requirements.txt
```

3. Run the server

```bash
python app.py
```

Visit http://localhost:8000 in your browser.

## Optional: External AI API

Set environment variables before running the app:

- `AI_API_URL` – The endpoint that accepts POST requests.
  - If an image is included, the request uses multipart with fields: `image` (file) and `prompt` (string).
  - If only a prompt is provided, the request sends JSON: `{ "prompt": "..." }`.
- `AI_API_KEY` – Optional bearer token sent in `Authorization: Bearer <AI_API_KEY>` header.

Expected responses supported:

- An image binary response (`Content-Type: image/*`) – treated as the resulting image
- JSON: `{ "image_base64": "..." }` – base64 string of the image

If the external API call fails or variables are unset, the app falls back to a local mock with Pillow:

- If an image is uploaded: grayscale + autocontrast + a small annotation with your prompt
- If only a prompt is sent: generates a stylized canvas with the prompt rendered

## KIE.ai Integration (optional)

The app includes a dedicated endpoint and frontend mode for KIE.ai task creation.

Server-side configuration:

- Set `KIE_API_KEY` environment variable (or in a `.env` file) with your KIE.ai API key.

Usage from the UI:

- In the Mode selector, choose "KIE.ai (createTask)".
- Enter your Prompt and a public Image URL.
- Click Proses to create a KIE.ai task. The response will show task creation status.

Direct API call (example):

POST `/api/kie/create-task`

Body:

```
{
  "model": "google/nano-banana-edit",
  "callBackUrl": null,
  "input": {
    "prompt": "...",
    "image_urls": ["https://example.com/image.png"],
    "output_format": "png",
    "image_size": "1:1"
  }
}
```

## Project Structure

```
.
├── app.py                # FastAPI app (serves API and static frontend)
├── requirements.txt      # Python dependencies
├── static/
│   ├── index.html        # Frontend UI
│   ├── styles.css        # Minimal, modern styling
│   └── script.js         # Fetch to backend and preview output
└── README.md
```

## Notes

- For development convenience, CORS allows all origins. Restrict this in production.
- Running `python app.py` launches uvicorn with reload.
- Fonts: The local mock attempts to use `Arial.ttf` and falls back to default if not found.

## Troubleshooting

- If you get invalid image errors, ensure the uploaded file is a valid image and not empty.
- External API errors are printed to the server console, and the app will use local mock processing automatically.
