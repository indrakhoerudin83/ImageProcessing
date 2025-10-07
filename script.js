// Handle form submission and integrate with backend API
const form = document.getElementById('aiForm');
const modeSelect = document.getElementById('mode');
const fileInput = document.getElementById('file');
const promptInput = document.getElementById('prompt');
const kieUrlGroup = document.getElementById('kieUrlGroup');
const imageUrlInput = document.getElementById('imageUrl');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const spinner = document.getElementById('spinner');
const outputImg = document.getElementById('outputImg');
const statusEl = document.getElementById('status');

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
  outputImg.src = '';
  outputImg.classList.add('hidden');
  statusEl.textContent = '';
}

clearBtn.addEventListener('click', () => clearAll());

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value;
  const isKie = mode === 'kie';
  kieUrlGroup.style.display = isKie ? '' : 'none';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const mode = modeSelect.value;
  const hasFile = fileInput.files && fileInput.files.length > 0;
  const prompt = (promptInput.value || '').trim();

  setLoading(true);
  try {
    if (mode === 'kie') {
      const imageUrl = (imageUrlInput.value || '').trim();
      if (!prompt || !imageUrl) {
        statusEl.textContent = 'Di mode KIE.ai, isi Prompt dan Image URL.';
        return;
      }
      const payload = {
        model: 'google/nano-banana-edit',
        callBackUrl: null,
        input: {
          prompt,
          image_urls: [imageUrl],
          output_format: 'png',
          image_size: '1:1',
        },
      };
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
      // Derive job id from typical fields
      const jobId = result.jobId || result.id || result.data?.id || result.taskId;
      if (!jobId) {
        statusEl.textContent = 'Task dibuat, namun jobId tidak ditemukan di respons.';
        return;
      }
      statusEl.textContent = `Task dibuat (${jobId}). Menunggu hasil…`;
      // Poll backend result endpoint which is populated by webhook callback
      const start = Date.now();
      const timeoutMs = 5 * 60 * 1000; // 5 menit
      const intervalMs = 2000;
      const timer = setInterval(async () => {
        try {
          const r = await fetch(`/api/kie/result?job_id=${encodeURIComponent(jobId)}`);
          if (!r.ok) throw new Error(`Status error ${r.status}`);
          const s = await r.json();
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
            setLoading(false);
          } else if (s.status === 'failed') {
            clearInterval(timer);
            setLoading(false);
            statusEl.textContent = 'Task gagal.';
          } else {
            statusEl.textContent = `KIE.ai: ${s.status || 'pending'}…`;
          }
          if (Date.now() - start > timeoutMs) {
            clearInterval(timer);
            setLoading(false);
            statusEl.textContent = 'Polling timeout (callback belum diterima).';
          }
        } catch (e) {
          clearInterval(timer);
          setLoading(false);
          statusEl.textContent = `Error polling: ${e.message || e}`;
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
