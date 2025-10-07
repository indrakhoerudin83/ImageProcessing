// Handle form submission and integrate with backend API
const form = document.getElementById('aiForm');
const modeSelect = document.getElementById('mode');
const fileInput = document.getElementById('file');
const promptInput = document.getElementById('prompt');
const kieUrlGroup = document.getElementById('kieUrlGroup');
const imageUrlInput = document.getElementById('imageUrl');
const kieModelGroup = document.getElementById('kieModelGroup');
const kieModelInput = document.getElementById('kieModel');
const kieCallbackGroup = document.getElementById('kieCallbackGroup');
const kieCallbackInput = document.getElementById('kieCallback');
const kieCallbackHint = document.getElementById('kieCallbackHint');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const spinner = document.getElementById('spinner');
const outputImg = document.getElementById('outputImg');
const statusEl = document.getElementById('status');
const debugToggle = document.getElementById('debugToggle');
const debugLog = document.getElementById('debugLog');

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
  submitBtn.disabled = isLoading;
  statusEl.textContent = msg || (isLoading ? 'Memproses…' : '');
}

function showImageFromBase64(b64) {
  outputImg.src = `data:image/png;base64,${b64}`;
  outputImg.classList.remove('hidden');
}

function clearAll() {
  fileInput.value = '';
  promptInput.value = '';
  imageUrlInput && (imageUrlInput.value = '');
  kieModelInput && (kieModelInput.value = 'google/nano-banana');
  kieCallbackInput && (kieCallbackInput.value = '');
  outputImg.src = '';
  outputImg.classList.add('hidden');
  statusEl.textContent = '';
}

clearBtn.addEventListener('click', () => clearAll());
debugToggle?.addEventListener('change', () => {
  debugLog.style.display = debugToggle.checked ? '' : 'none';
});

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value;
  const isKie = mode === 'kie';
  kieUrlGroup.style.display = isKie ? '' : 'none';
  kieModelGroup.style.display = isKie ? '' : 'none';
  kieCallbackGroup.style.display = isKie ? '' : 'none';
  if (isKie) {
    // Ask backend what callback URL will be used automatically
    fetch('/api/kie/preview-callback').then(async (r) => {
      if (!r.ok) return;
      const j = await r.json();
      if (j.autoCallbackUrl) {
        kieCallbackHint.textContent = `Jika dikosongkan, server akan mengisi otomatis: ${j.autoCallbackUrl}`;
      }
    }).catch(() => {});
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const mode = modeSelect.value;
  const hasFile = fileInput.files && fileInput.files.length > 0;
  const prompt = (promptInput.value || '').trim();

  setLoading(true);
  try {
    if (mode === 'kie') {
      let imageUrl = (imageUrlInput.value || '').trim();
      const model = (kieModelInput?.value || 'google/nano-banana').trim();
      const cbUrl = (kieCallbackInput?.value || '').trim();
      if (!prompt) {
        statusEl.textContent = 'Di mode KIE.ai, Prompt wajib diisi.';
        return;
      }
      // If user uploaded a file, upload to temp endpoint to get a public URL for KIE
      if (!imageUrl && hasFile) {
        try {
          statusEl.textContent = 'Mengunggah gambar…';
          const up = new FormData();
          up.append('file', fileInput.files[0]);
          const r = await fetch('/api/upload-temp-image', { method: 'POST', body: up });
          if (!r.ok) throw new Error(`Upload gagal (${r.status})`);
          const j = await r.json();
          imageUrl = j.url;
          logDebug('temp image url', imageUrl);
        } catch (e) {
          setLoading(false);
          statusEl.textContent = `Gagal upload gambar: ${e.message || e}`;
          return;
        }
      }
      const payload = {
        model: model || 'google/nano-banana',
        input: {
          prompt,
          ...(imageUrl ? { image_urls: [imageUrl] } : {}),
          output_format: 'png',
          image_size: '1:1',
        },
        ...(cbUrl ? { callBackUrl: cbUrl } : {}),
      };
      logDebug('create-task payload', payload);
      const resp = await fetch('/api/kie/create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        let msg = `Gagal (${resp.status})`;
        try { const j = await resp.json(); msg = j.detail || JSON.stringify(j); } catch {}
        throw new Error(msg);
      }
      const result = await resp.json();
      logDebug('create-task result', result);
      // Derive job id from typical fields (prefer KIE data.taskId)
      const jobId = result?.data?.taskId || result?.data?.id || result?.taskId || result?.id || result?.data?.recordId;
      logDebug('derived jobId', jobId);
      if (!jobId) {
        statusEl.textContent = 'Task dibuat, namun jobId tidak ditemukan di respons.';
        return;
      }
  statusEl.textContent = `Task dibuat (${jobId}). Menyiapkan koneksi SSE…`;
      // Prefer SSE for instant updates; fallback to polling
      let settled = false;
      let es;
      try {
  es = new EventSource(`/api/kie/events?job_id=${encodeURIComponent(jobId)}`);
  es.onopen = () => { logDebug('SSE opened'); statusEl.textContent = `SSE tersambung. Menunggu hasil…`; };
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
              statusEl.textContent = 'Selesai (SSE callback)';
            } else if (out?.image_base64) {
              outputImg.src = `data:image/png;base64,${out.image_base64}`;
              outputImg.classList.remove('hidden');
              statusEl.textContent = 'Selesai (SSE callback)';
            } else {
              statusEl.textContent = 'Task selesai tapi tidak ada gambar pada output.';
            }
            settled = true;
            setLoading(false);
            es && es.close();
            logDebug('SSE closed (delivered)');
            statusEl.textContent = statusEl.textContent || 'Selesai (SSE callback)';
          } catch (err) {
            // Ignore parse errors, fallback to polling if needed
          }
        };
        es.onerror = (e) => {
          // SSE may fail behind some proxies; we'll rely on polling below
          es && es.close();
          logDebug('SSE error/closed', e);
          if (!settled) statusEl.textContent = 'SSE gagal, beralih ke polling…';
        };
      } catch {}

      // Polling fallback with timeout
      const start = Date.now();
      const timeoutMs = 5 * 60 * 1000; // 5 menit
      const intervalMs = 2000;
      let firstPoll = true;
      const timer = setInterval(async () => {
        if (settled) { clearInterval(timer); return; }
        try {
          const r = await fetch(`/api/kie/result?job_id=${encodeURIComponent(jobId)}`);
          if (!r.ok) throw new Error(`Status error ${r.status}`);
          const s = await r.json();
          logDebug('poll result', s);
          if (firstPoll) { statusEl.textContent = 'Polling hasil…'; firstPoll = false; }
          if (s.status === 'completed' || s.output) {
            clearInterval(timer);
            const out = s.output || s.raw?.output || s.raw?.data?.output;
            if (out?.image_url) {
              outputImg.src = out.image_url;
              outputImg.classList.remove('hidden');
              statusEl.textContent = 'Selesai (callback)';
            } else if (out?.image_base64) {
              outputImg.src = `data:image/png;base64,${out.image_base64}`;
              outputImg.classList.remove('hidden');
              statusEl.textContent = 'Selesai (callback)';
            } else {
              statusEl.textContent = 'Task selesai tapi tidak ada gambar pada output.';
            }
            settled = true;
            setLoading(false);
            es && es.close();
            logDebug('poll delivered, closing');
          } else if (s.status === 'failed') {
            clearInterval(timer);
            setLoading(false);
            statusEl.textContent = 'Task gagal.';
            logDebug('poll status failed');
          } else {
            statusEl.textContent = `KIE.ai: ${s.status || 'pending'}…`;
          }
          if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            setLoading(false);
            statusEl.textContent = 'Timeout menunggu hasil.';
            es && es.close();
            logDebug('poll timeout');
          }
        } catch (e) {
          clearInterval(timer);
          setLoading(false);
          statusEl.textContent = `Error polling: ${e.message || e}`;
          es && es.close();
          logDebug('poll error', e);
        }
      }, intervalMs);
    } else {
      if (!hasFile && !prompt) {
        statusEl.textContent = 'Mohon unggah gambar atau isi teks perintah.';
        return;
      }
      const formData = new FormData();
      if (hasFile) formData.append('file', fileInput.files[0]);
      if (prompt) formData.append('prompt', prompt);
      const resp = await fetch('/api/process', { method: 'POST', body: formData });
      if (!resp.ok) {
        let msg = `Gagal (${resp.status})`;
        try { const j = await resp.json(); msg = j.detail || msg; } catch {}
        throw new Error(msg);
      }
      const data = await resp.json();
      if (!data.image_base64) throw new Error('Respons API tidak valid.');
      showImageFromBase64(data.image_base64);
      statusEl.textContent = data.source === 'external' ? 'Sumber: API eksternal' : 'Sumber: mock lokal';
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error: ${err.message || err}`;
  } finally {
    setLoading(false);
  }
});
