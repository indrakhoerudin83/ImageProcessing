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
  statusEl.textContent = msg || (isLoading ? 'Processing…' : '');
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
  statusEl.textContent = '';
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

  setLoading(true);
  try {
    let imageUrl = '';
    if (!prompt) {
      statusEl.textContent = 'Prompt wajib diisi.';
      return;
    }
    // If user uploaded a file, upload to temp endpoint to get a public URL for KIE
    if (hasFile) {
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
  statusEl.textContent = `Image upload failed: ${e.message || e}`;
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
  statusEl.textContent = 'Task created, but jobId was not found in the response.';
      return;
    }
  statusEl.textContent = `Task created (${jobId}). Preparing SSE connection…`;
    // Prefer SSE for instant updates; fallback to polling
    let settled = false;
    let es;
    try {
      es = new EventSource(`/api/kie/events?job_id=${encodeURIComponent(jobId)}`);
  es.onopen = () => { logDebug('SSE opened'); statusEl.textContent = `SSE connected. Waiting for result…`; };
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
              statusEl.textContent = 'Done (SSE callback)';
            spinner.classList.remove('running');
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              statusEl.textContent = 'Done (SSE callback)';
            spinner.classList.remove('running');
          } else {
              statusEl.textContent = 'Task finished but no image found in output.';
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
          if (!settled) statusEl.textContent = 'SSE failed, switching to polling…';
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
  if (firstPoll) { statusEl.textContent = 'Polling for result…'; firstPoll = false; }
        if (s.status === 'completed' || s.output) {
          clearInterval(timer);
          const out = s.output || s.raw?.output || s.raw?.data?.output;
            if (out?.image_url) {
            outputImg.src = out.image_url;
            outputImg.classList.remove('hidden');
              statusEl.textContent = 'Done (callback)';
              spinner.classList.remove('running');
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              statusEl.textContent = 'Done (callback)';
              spinner.classList.remove('running');
          } else {
              statusEl.textContent = 'Task finished but no image found in output.';
          }
          settled = true;
          setLoading(false);
          es && es.close();
          logDebug('poll delivered, closing');
        } else if (s.status === 'failed') {
          clearInterval(timer);
          setLoading(false);
            statusEl.textContent = 'Task failed.';
          logDebug('poll status failed');
        } else {
          statusEl.textContent = `KIE.ai: ${s.status || 'pending'}…`;
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(timer);
          setLoading(false);
          statusEl.textContent = 'Timeout waiting for result.';
          es && es.close();
          logDebug('poll timeout');
        }
      } catch (e) {
        clearInterval(timer);
        setLoading(false);
  statusEl.textContent = `Polling error: ${e.message || e}`;
        es && es.close();
        logDebug('poll error', e);
      }
    }, intervalMs);
  } catch (err) {
    console.error(err);
  statusEl.textContent = `Error: ${err.message || err}`;
  } finally {
    setLoading(false);
  }
});
