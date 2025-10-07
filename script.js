// Handle form submission and integrate with backend API
const form = document.getElementById('aiForm');
const fileInput = document.getElementById('file');
const promptInput = document.getElementById('prompt');
// Removed optional KIE fields (imageUrl, model, callback) from UI
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const spinner = document.getElementById('spinner');
const outputImg = document.getElementById('outputImg');
const statusEl = document.getElementById('status');
const debugToggle = document.getElementById('debugToggle');
const debugLog = document.getElementById('debugLog');

// Feature flag: keep original palette by default; set to true to auto-match palette from image
const ENABLE_DYNAMIC_PALETTE = false;
// Small utility to update CSS vars globally
const setVar = (name, value) => document.documentElement.style.setProperty(name, value);

// Subtle reveal for cards on mount
window.requestAnimationFrame(() => {
  document.querySelectorAll('.tool-card, .preview-card').forEach((el, i) => {
    el.classList.add('reveal');
    setTimeout(() => el.classList.add('show'), 50 + i * 90);
  });
});

// Button ripple micro-interaction
function attachRipple(btn) {
  btn.addEventListener('click', (e) => {
    const rect = btn.getBoundingClientRect();
    const circle = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 1.2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    circle.className = 'ripple';
    circle.style.width = circle.style.height = `${size}px`;
    circle.style.left = `${x}px`;
    circle.style.top = `${y}px`;
    btn.appendChild(circle);
    setTimeout(() => circle.remove(), 650);
  });
}
attachRipple(submitBtn);
attachRipple(clearBtn);

function logDebug(...args) {
  try {
    if (!debugToggle || !debugLog) return;
    if (!debugToggle.checked) return;
    const ts = new Date().toISOString();
    const line = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    debugLog.textContent += `\n[${ts}] ${line}`;
    debugLog.style.display = '';
    debugLog.scrollTop = debugLog.scrollHeight;
  } catch {}
}

function setLoading(isLoading, msg = '') {
  spinner.classList.toggle('hidden', !isLoading);
  spinner.classList.toggle('running', isLoading);
  submitBtn.disabled = isLoading;
  updateStatus(msg || (isLoading ? 'Processing…' : ''));
}

function showImageFromBase64(b64) {
  outputImg.src = `data:image/png;base64,${b64}`;
  outputImg.classList.remove('hidden');
  spinner.classList.remove('running');
}

function clearAll() {
  fileInput.value = '';
  promptInput.value = '';
  outputImg.src = '';
  outputImg.classList.add('hidden');
  updateStatus('');
  // Ensure spinner is fully stopped and hidden when clearing
  spinner.classList.add('hidden');
  spinner.classList.remove('running');
  // Reset dynamic palette back to defaults
  setVar('--accent', 'var(--blue-500)');
  setVar('--accent-2', 'var(--red-500)');
}

clearBtn.addEventListener('click', () => clearAll());
debugToggle?.addEventListener('change', () => {
  debugLog.style.display = debugToggle.checked ? '' : 'none';
});

// No dynamic KIE fields to toggle anymore

form.addEventListener('submit', async (e) => {
  e.preventDefault();

    // No mode selection; always use KIE flow
  const hasFile = fileInput.files && fileInput.files.length > 0;
  const prompt = (promptInput.value || '').trim();

  try {
    let imageUrl = '';
    if (!prompt) {
      updateStatus('Prompt is required.');
      return;
    }
    // Begin processing after validation passes
    setLoading(true);
    // If user uploaded a file, upload to temp endpoint to get a public URL for KIE
    if (hasFile) {
  try {
  updateStatus('Uploading image…');
        const up = new FormData();
        up.append('file', fileInput.files[0]);
        const r = await fetch('/api/upload-temp-image', { method: 'POST', body: up });
        if (!r.ok) throw new Error(`Upload gagal (${r.status})`);
        const j = await r.json();
        imageUrl = j.url;
        logDebug('temp image url', imageUrl);
        if (ENABLE_DYNAMIC_PALETTE) {
          // Apply palette from the uploaded local image as early feedback
          await applyPaletteFromFile(fileInput.files[0]);
        }
      } catch (e) {
        setLoading(false);
  updateStatus(`Image upload failed: ${e.message || e}`);
        return;
      }
    }
    const payload = {
      model: 'google/nano-banana',
      input: {
        prompt,
        ...(imageUrl ? { image_urls: [imageUrl] } : {}),
        output_format: 'png',
        image_size: '1:1',
      },
      // callBackUrl omitted; server auto-injects
    };
    logDebug('create-task payload', payload);
    const resp = await fetch('/api/kie/create-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      let msg = `Failed (${resp.status})`;
      try { const j = await resp.json(); msg = j.detail || JSON.stringify(j); } catch {}
      throw new Error(msg);
    }
    const result = await resp.json();
    logDebug('create-task result', result);
    // Derive job id from typical fields (prefer KIE data.taskId)
    const jobId = result?.data?.taskId || result?.data?.id || result?.taskId || result?.id || result?.data?.recordId;
    logDebug('derived jobId', jobId);
    if (!jobId) {
      updateStatus('Task created, but jobId was not found in the response.');
      setLoading(false);
      return;
    }
  updateStatus(`Task created (${jobId}). Preparing SSE connection…`);
    // Prefer SSE for instant updates; fallback to polling
    let settled = false;
    let es;
    try {
      es = new EventSource(`/api/kie/events?job_id=${encodeURIComponent(jobId)}`);
  es.onopen = () => { logDebug('SSE opened'); updateStatus('SSE connected. Waiting for result…'); };
      es.onmessage = (evt) => {
        if (settled) return;
        try {
          const data = JSON.parse(evt.data);
          const payload = data?.payload;
          const out = payload?.output || payload?.data?.output;
          logDebug('SSE message', data);
          if (out?.image_url) {
            outputImg.src = out.image_url;
            outputImg.classList.remove('hidden');
              updateStatus('Done (SSE callback)');
            spinner.classList.remove('running');
            appearImage();
            if (ENABLE_DYNAMIC_PALETTE) {
              // Derive palette from the resulting image URL
              derivePaletteFromImageURL(out.image_url);
            }
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              updateStatus('Done (SSE callback)');
            spinner.classList.remove('running');
            appearImage();
            if (ENABLE_DYNAMIC_PALETTE) {
              // Base64 source, still can sample via an Image element
              derivePaletteFromImageURL(outputImg.src);
            }
          } else {
              updateStatus('Task finished but no image found in output.');
          }
          settled = true;
          setLoading(false);
          es && es.close();
          logDebug('SSE closed (delivered)');
          updateStatus(statusEl.textContent || 'Done (SSE callback)');
        } catch (err) {
          // Ignore parse errors, fallback to polling if needed
        }
      };
      es.onerror = (e) => {
        // SSE may fail behind some proxies; we'll rely on polling below
        es && es.close();
        logDebug('SSE error/closed', e);
          if (!settled) updateStatus('SSE failed, switching to polling…');
      };
    } catch {}

    // Polling fallback with timeout
    const start = Date.now();
  const timeoutMs = 5 * 60 * 1000; // 5 minutes
    const intervalMs = 2000;
    let firstPoll = true;
    const timer = setInterval(async () => {
      if (settled) { clearInterval(timer); return; }
      try {
        const r = await fetch(`/api/kie/result?job_id=${encodeURIComponent(jobId)}`);
        if (!r.ok) throw new Error(`Status error ${r.status}`);
        const s = await r.json();
        logDebug('poll result', s);
  if (firstPoll) { updateStatus('Polling for result…'); firstPoll = false; }
        if (s.status === 'completed' || s.output) {
          clearInterval(timer);
          const out = s.output || s.raw?.output || s.raw?.data?.output;
            if (out?.image_url) {
            outputImg.src = out.image_url;
            outputImg.classList.remove('hidden');
              updateStatus('Done (callback)');
              spinner.classList.remove('running');
              appearImage();
              if (ENABLE_DYNAMIC_PALETTE) derivePaletteFromImageURL(out.image_url);
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              updateStatus('Done (callback)');
              spinner.classList.remove('running');
              appearImage();
              if (ENABLE_DYNAMIC_PALETTE) derivePaletteFromImageURL(outputImg.src);
          } else {
              updateStatus('Task finished but no image found in output.');
          }
          settled = true;
          setLoading(false);
          es && es.close();
          logDebug('poll delivered, closing');
        } else if (s.status === 'failed') {
          clearInterval(timer);
          setLoading(false);
            updateStatus('Task failed.');
          logDebug('poll status failed');
        } else {
          updateStatus(`KIE.ai: ${s.status || 'pending'}…`);
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          setLoading(false);
          updateStatus('Timeout waiting for result.');
          es && es.close();
          logDebug('poll timeout');
        }
      } catch (e) {
        clearInterval(timer);
        setLoading(false);
  updateStatus(`Polling error: ${e.message || e}`);
        es && es.close();
        logDebug('poll error', e);
      }
    }, intervalMs);
  } catch (err) {
    console.error(err);
  updateStatus(`Error: ${err.message || err}`);
  } finally {
    setLoading(false);
  }
});

// Helper: fade status text on change
let lastStatus = '';
function updateStatus(text) {
  if (text === undefined || text === null) text = '';
  if (statusEl.textContent !== text) {
    statusEl.textContent = text;
    statusEl.classList.remove('status-change');
    // trigger reflow to restart animation
    void statusEl.offsetWidth;
    statusEl.classList.add('status-change');
  }
  lastStatus = text;
}

// Helper: animate image appearance
function appearImage() {
  outputImg.classList.remove('img-appear');
  void outputImg.offsetWidth;
  outputImg.classList.add('img-appear');
}

// Palette extraction: find two dominant hues to map to --accent and --accent-2
async function applyPaletteFromFile(file) {
  try {
    const url = URL.createObjectURL(file);
    await derivePaletteFromImageURL(url);
    URL.revokeObjectURL(url);
  } catch (e) { /* ignore */ }
}

async function derivePaletteFromImageURL(url) {
  try {
    const img = await loadImage(url);
    const { main, secondary } = extractPalette(img);
    if (main) setVar('--accent', main);
    if (secondary) setVar('--accent-2', secondary);
    logDebug('palette', { main, secondary });
  } catch (e) { logDebug('palette fail', e); }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Simple palette extraction via coarse pixel sampling and k-means-ish binning
function extractPalette(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // Small canvas to speed up
  const w = 64, h = Math.round((img.height / img.width) * 64) || 64;
  canvas.width = w; canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  // Sample every Nth pixel to reduce cost
  const step = 4 * 5; // RGBA stride * skip
  const colors = [];
  for (let i = 0; i < data.length; i += step) {
    const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    if (a < 128) continue; // skip transparent
    colors.push([r, g, b]);
  }
  if (!colors.length) return { main: null, secondary: null };
  // Convert to HSL and cluster by hue buckets
  const buckets = new Map();
  for (const [r, g, b] of colors) {
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l < 0.1 || l > 0.9 || s < 0.2) continue; // prefer vivid midtones
    const key = Math.round(h * 12) / 12; // 12 buckets
    const arr = buckets.get(key) || [];
    arr.push({ h, s, l });
    buckets.set(key, arr);
  }
  const ranked = [...buckets.entries()].map(([k, arr]) => ({ key: k, count: arr.length, avg: avgHsl(arr) }))
    .sort((a, b) => b.count - a.count);
  if (!ranked.length) {
    // fallback to median color
    const mid = colors[Math.floor(colors.length / 2)];
    const hex = rgbToHex(...mid);
    return { main: hex, secondary: shade(hex, -0.15) };
  }
  const main = hslToHex(ranked[0].avg);
  const secondary = ranked[1] ? hslToHex(ranked[1].avg) : shade(main, -0.15);
  return { main, secondary };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color);
  };
  return rgbToHex(f(0), f(8), f(4));
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function avgHsl(arr) {
  // naive avg in HSL space
  const n = arr.length;
  const sum = arr.reduce((acc, v) => ({ h: acc.h + v.h, s: acc.s + v.s, l: acc.l + v.l }), { h: 0, s: 0, l: 0 });
  return { h: sum.h / n, s: sum.s / n, l: sum.l / n };
}

function shade(hex, amt) {
  // shade by mixing with black/white
  const { r, g, b } = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const R = Math.round((t - r) * p) + r;
  const G = Math.round((t - g) * p) + g;
  const B = Math.round((t - b) * p) + b;
  return rgbToHex(R, G, B);
}

function hexToRgb(hex) {
  const res = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!res) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(res[1], 16), g: parseInt(res[2], 16), b: parseInt(res[3], 16) };
}
