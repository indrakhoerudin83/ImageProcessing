import os
import io
import base64
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

import httpx
from PIL import Image, ImageDraw, ImageFont, ImageOps
from pydantic import BaseModel
from dotenv import load_dotenv


# ----------------------------------------------------------------------------
# FastAPI app setup
# ----------------------------------------------------------------------------
load_dotenv()  # Load environment variables from .env if present

app = FastAPI(title="Mini Photoshop AI API", version="1.1.0")

# Allow same-origin and local dev access; adjust origins for production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


PROJECT_ROOT = os.path.dirname(__file__)
INDEX_FILE = os.path.join(PROJECT_ROOT, "index.html")


@app.get("/")
def root():
    """Serve the single-page app."""
    return FileResponse(INDEX_FILE)


@app.get("/styles.css")
def styles_css():
    """Serve the root-level stylesheet."""
    path = os.path.join(PROJECT_ROOT, "styles.css")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="styles.css not found")
    return FileResponse(path, media_type="text/css")


@app.get("/script.js")
def script_js():
    """Serve the root-level JavaScript."""
    path = os.path.join(PROJECT_ROOT, "script.js")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="script.js not found")
    return FileResponse(path, media_type="application/javascript")


@app.get("/health")
def health():
    return {"status": "ok"}


# ----------------------------------------------------------------------------
# Utilities
# ----------------------------------------------------------------------------
def _image_to_bytes(img: Image.Image, format: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


def _bytes_to_image(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("RGBA")


def _safe_resize(img: Image.Image, max_size: int = 1280) -> Image.Image:
    """Resize keeping aspect ratio if larger than max_size on either dimension."""
    w, h = img.size
    if max(w, h) <= max_size:
        return img
    scale = max_size / float(max(w, h))
    new_size = (int(w * scale), int(h * scale))
    return img.resize(new_size, Image.LANCZOS)


def _b64encode_image_bytes(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


def _annotate(img: Image.Image, text: str, pos: tuple[int, int] = (10, 10)) -> Image.Image:
    draw = ImageDraw.Draw(img)
    try:
        # Try a common system font; fallback to default if not found
        font = ImageFont.truetype("Arial.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    # Draw semi-transparent rectangle behind text for readability
    text_bbox = draw.textbbox(pos, text, font=font)
    pad = 6
    rect = (text_bbox[0] - pad, text_bbox[1] - pad, text_bbox[2] + pad, text_bbox[3] + pad)
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rectangle(rect, fill=(0, 0, 0, 120), outline=(255, 255, 255, 160), width=1)
    img = Image.alpha_composite(img, overlay)
    draw = ImageDraw.Draw(img)
    draw.text(pos, text, font=font, fill=(255, 255, 255, 230))
    return img


def _pillow_process_image(image_bytes: bytes, prompt: Optional[str] = None) -> bytes:
    """Local mock: apply a simple effect (auto-contrast + grayscale) and optional note."""
    img = _bytes_to_image(image_bytes)
    img = _safe_resize(img)
    # Simple effects to simulate processing
    img = ImageOps.autocontrast(img)
    img = ImageOps.grayscale(img).convert("RGBA")
    if prompt:
        img = _annotate(img, f"Mock AI: {prompt[:40]}" + ("…" if len(prompt) > 40 else ""))
    return _image_to_bytes(img, "PNG")


def _pillow_generate_from_prompt(prompt: str) -> bytes:
    """Local mock: generate a canvas with the prompt rendered."""
    w, h = 1024, 640
    bg = Image.new("RGBA", (w, h), (24, 24, 28, 255))
    # Decorative gradient bars
    deco = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    deco_draw = ImageDraw.Draw(deco)
    for i in range(0, h, 16):
        alpha = int(60 * (1 - i / h))
        deco_draw.rectangle([(0, i), (w, i + 8)], fill=(99, 102, 241, alpha))
    bg = Image.alpha_composite(bg, deco)

    draw = ImageDraw.Draw(bg)
    try:
        font_title = ImageFont.truetype("Arial.ttf", 36)
        font_body = ImageFont.truetype("Arial.ttf", 22)
    except Exception:
        font_title = ImageFont.load_default()
        font_body = ImageFont.load_default()

    title = "AI Preview (local mock)"
    draw.text((32, 24), title, font=font_title, fill=(255, 255, 255, 230))

    # Wrap prompt text roughly
    import textwrap

    wrapped = textwrap.fill(prompt, width=48)
    draw.multiline_text((32, 88), wrapped, font=font_body, fill=(235, 235, 245, 230), spacing=6)

    return _image_to_bytes(bg, "PNG")


async def _call_external_ai_api(image_bytes: Optional[bytes], prompt: Optional[str]) -> Optional[bytes]:
    """
    Attempt to call an external AI API.
    Configure via environment variables:
      - AI_API_URL: The endpoint to call
      - AI_API_KEY: Optional bearer/API key

    Expected responses supported:
      - image/* binary body
      - JSON { "image_base64": "..." }
    """
    api_url = os.getenv("AI_API_URL")
    if not api_url:
        return None

    headers = {}
    api_key = os.getenv("AI_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    timeout = httpx.Timeout(30.0, read=120.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        files = {}
        data = {}
        if prompt:
            data["prompt"] = prompt
        if image_bytes:
            files["image"] = ("input.png", image_bytes, "image/png")

        try:
            # Prefer multipart if image present, else JSON
            if files:
                resp = await client.post(api_url, headers=headers, data=data, files=files)
            else:
                resp = await client.post(api_url, headers={**headers, "Content-Type": "application/json"}, json=data)
            resp.raise_for_status()

            ctype = resp.headers.get("content-type", "")
            if ctype.startswith("image/"):
                return resp.content
            # Assume JSON
            payload = resp.json()
            b64 = payload.get("image_base64")
            if b64:
                return base64.b64decode(b64)
            raise ValueError("Unsupported API response shape")
        except Exception as e:
            # Log and fall back to local mock
            print(f"[AI_API] External call failed: {e}")
            return None


# ----------------------------------------------------------------------------
# API endpoints
# ----------------------------------------------------------------------------
@app.post("/api/process")
async def process(
    file: Optional[UploadFile] = File(default=None),
    prompt: Optional[str] = Form(default=None),
):
    """
    Accepts either an uploaded image (file) or a text prompt.
    - If AI_API_URL is configured, will attempt to call the external API first.
    - If that fails or isn't configured, falls back to local mock using Pillow.
    Returns JSON with base64 encoded PNG.
    """
    if not file and not (prompt and prompt.strip()):
        raise HTTPException(status_code=400, detail="Provide an image or a prompt.")

    prompt = (prompt or "").strip()
    image_bytes: Optional[bytes] = None

    if file:
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Uploaded file must be an image.")
        image_bytes = await file.read()
        # Sanity-check image can be opened
        try:
            _ = _bytes_to_image(image_bytes)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid image file.")

    # Try external API first if configured
    ext_result = await _call_external_ai_api(image_bytes=image_bytes, prompt=prompt or None)
    if ext_result is not None:
        b64 = _b64encode_image_bytes(ext_result)
        return JSONResponse({"image_base64": b64, "source": "external"})

    # Local mock fallback
    if image_bytes:
        output = _pillow_process_image(image_bytes, prompt or None)
    else:
        output = _pillow_generate_from_prompt(prompt)

    return JSONResponse({"image_base64": _b64encode_image_bytes(output), "source": "local-mock"})


# ----------------------------- KIE.ai Integration ----------------------------
class KIEInput(BaseModel):
    prompt: str
    image_urls: List[str]
    output_format: str = "png"
    image_size: str = "1:1"


class KIECreateTaskRequest(BaseModel):
    model: str = "google/nano-banana-edit"
    callBackUrl: Optional[str] = None
    input: KIEInput


@app.post("/api/kie/create-task")
async def kie_create_task(body: KIECreateTaskRequest):
    """
    Proxy endpoint to create a task in KIE.ai.
    Requires env KIE_API_KEY. Uses fixed endpoint: https://api.kie.ai/api/v1/jobs/createTask
    """
    kie_api_key = os.getenv("KIE_API_KEY")
    if not kie_api_key:
        raise HTTPException(status_code=500, detail="KIE_API_KEY is not configured on the server.")

    url = "https://api.kie.ai/api/v1/jobs/createTask"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {kie_api_key}",
    }

    # Auto-inject callback URL if configured and not provided in request
    cb_url_env = os.getenv("KIE_CALLBACK_URL")
    cb_token = os.getenv("KIE_CALLBACK_TOKEN")

    payload = body.model_dump()
    if not payload.get("callBackUrl") and cb_url_env:
        payload["callBackUrl"] = cb_url_env if not cb_token else f"{cb_url_env}?token={cb_token}"

    timeout = httpx.Timeout(30.0, read=120.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            return JSONResponse(resp.json())
        except httpx.HTTPStatusError as e:
            # Bubble up API error details if present
            msg = None
            try:
                msg = e.response.json()
            except Exception:
                msg = e.response.text
            raise HTTPException(status_code=e.response.status_code, detail=msg)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


# In-memory store for callback results (for production, use Redis/DB)
KIE_RESULTS: Dict[str, Any] = {}


def _extract_job_id(payload: Dict[str, Any]) -> Optional[str]:
    # Try common keys
    for key in ("id", "jobId", "job_id", "taskId", "task_id"):
        if key in payload and isinstance(payload[key], (str, int)):
            return str(payload[key])
    # Try nested `data` object
    data = payload.get("data")
    if isinstance(data, dict):
        for key in ("id", "jobId", "job_id", "taskId", "task_id"):
            if key in data and isinstance(data[key], (str, int)):
                return str(data[key])
    return None


@app.post("/api/kie/callback")
async def kie_callback(request: Request, token: Optional[str] = Query(default=None)):
    """
    Webhook endpoint to receive KIE.ai task results.
    Optional protection via KIE_CALLBACK_TOKEN env var.
    """
    expected = os.getenv("KIE_CALLBACK_TOKEN")
    if expected and token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized callback")

    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ValueError("Invalid payload")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")

    job_id = _extract_job_id(payload)
    if not job_id:
        raise HTTPException(status_code=400, detail="Missing job id in payload")

    KIE_RESULTS[job_id] = payload
    return {"ok": True, "job_id": job_id}


@app.get("/api/kie/result")
def kie_result(job_id: str):
    """Return stored KIE callback result if present; otherwise pending."""
    data = KIE_RESULTS.get(job_id)
    if data is None:
        return {"status": "pending", "job_id": job_id}
    # Try to surface a normalized view
    status = data.get("status") or data.get("state") or data.get("data", {}).get("status")
    output = data.get("output") or data.get("data", {}).get("output")
    return {"status": status or "completed", "job_id": job_id, "raw": data, "output": output}


if __name__ == "__main__":
    # For convenience: python app.py
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)

