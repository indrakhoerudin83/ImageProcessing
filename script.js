const requiredHint = document.getElementById('requiredHint');

const beforeImg = document.getElementById('beforeImg');
const com  // Show preview with large preview system
  const url = URL.createObjectURL(f);
  img.src = url;
  dzPreview.src = url;
  dzPreview.classList.remove('hidden');
  
  // Show large preview
  if (largePreview && largePreviewImg && previewFilename) {
    largePreviewImg.src = url;
    previewFilename.textContent = f.name;
    largePreview.classList.remove('hidden');
  }
  
  // Set before image for compare slider
  if (beforeImg) { beforeImg.src = url; beforeImg.classList.remove('hidden'); }
  // Add small thumbnail inside dropzone
  if (dzThumbs) {
    dzThumbs.innerHTML = '';
    const t = new Image();
    t.src = url;
    t.alt = 'thumbnail';
    t.className = 'dz-thumb';
    dzThumbs.appendChild(t);
  }ument.getElementById('compareSlider');
const compareDivider = document.getElementById('compareDivider');
const resultActions = document.getElementById('resultActions');
const downloadBtn = document.getElementById('downloadBtn');
const openBtn = document.getElementById('openBtn');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const stickyActions = document.getElementById('stickyActions');
const stickySubmit = document.getElementById('stickySubmit');
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
// Button animation helpers
function setProcessingUI(isProcessing) {
  submitBtn.classList.toggle('processing', isProcessing);
  submitBtn.disabled = isProcessing;
  clearBtn.disabled = isProcessing;
  
  // Update button text
  const btnText = submitBtn.querySelector('.btn-text');
  if (btnText) {
    btnText.textContent = isProcessing ? 'Generating...' : 'Generate';
  }
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth; // restart animation
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}
// Enhanced UI elements
const dropzone = document.getElementById('dropzone');
const fileInfo = document.getElementById('fileInfo');
const dzPreview = document.getElementById('dzPreview');
const largePreview = document.getElementById('largePreview');
const largePreviewImg = document.getElementById('largePreviewImg');
const previewFilename = document.getElementById('previewFilename');
const promptCounter = document.getElementById('promptCounter');
const showExamplesBtn = document.getElementById('showExamplesBtn');
const downloadSection = document.getElementById('downloadSection');
const comparisonContainer = document.getElementById('comparisonContainer');
const progressBar = document.getElementById('progressBar');
const toastContainer = document.getElementById('toastContainer');
const dzThumbs = document.getElementById('dzThumbs');

// Progress bar controls
function progressStart() { if (progressBar) { progressBar.classList.remove('hidden','done','near-done'); progressBar.classList.add('active'); } }
function progressNearDone() { if (progressBar) { progressBar.classList.add('near-done'); } }
function progressDone() { if (progressBar) { progressBar.classList.remove('active','near-done'); progressBar.classList.add('done'); setTimeout(() => progressBar.classList.add('hidden'), 300); } }

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
  // Ensure header logo loads even if the file uses a different extension
  const logo = document.querySelector('.brand-logo');
  if (logo) {
    const tryNext = (srcs, idx=0) => {
      if (idx >= srcs.length) return;
      logo.onerror = () => tryNext(srcs, idx+1);
      logo.src = srcs[idx];
    };
    // Start from /static/logo.png then fallback to jpg/jpeg/svg
    const base = '/static/logo';
    tryNext([`${base}.png`, `${base}.jpg`, `${base}.jpeg`, `${base}.svg`]);
  }
});

// --- Enhanced Dropzone interactions ---
function handleFiles(files) {
  if (!files || !files.length) return;
  const f = files[0];
  
  // Show processing state
  showFileProcessing(f.name);
  
  // Validate file with enhanced validation
  const validation = validateImageFile(f);
  if (!validation.valid) {
    toast(validation.error, 'error');
    shake(dropzone);
    hideFileProcessing();
    return;
  }
  
  fileInput.files = files;
  
  // Update file info with enhanced display
  updateFileInfo(f);
  
  // Show preview with large preview system
  const url = URL.createObjectURL(f);
  
  const img = new Image();
  img.onload = () => {
    // Update preview images
    dzPreview.src = url;
    dzPreview.classList.remove('hidden');
    
    // Show large preview
    if (largePreview && largePreviewImg && previewFilename) {
      largePreviewImg.src = url;
      previewFilename.textContent = f.name;
      largePreview.classList.remove('hidden');
    }
    
    // Set before image for compare slider
    if (beforeImg) { 
      beforeImg.src = url; 
      beforeImg.classList.remove('hidden'); 
    }
    
    // Add small thumbnail inside dropzone
    if (dzThumbs) {
      dzThumbs.innerHTML = '';
      const t = new Image();
      t.src = url;
      t.alt = 'thumbnail';
      t.className = 'dz-thumb';
      dzThumbs.appendChild(t);
    }
    
    // Success feedback
    toast(`Image loaded successfully: ${f.name}`, 'success');
    announceToScreenReader(`Image ${f.name} loaded successfully. Size: ${img.width} by ${img.height} pixels.`);
    
    hideFileProcessing();
  };
  
  img.onerror = () => {
    toast(`Image loaded but dimensions unavailable: ${f.name}`, 'info');
    hideFileProcessing();
  };
  
  img.src = url;
}

// ========== ENHANCED DRAG & DROP FUNCTIONALITY ==========

if (dropzone) {
  // Click to upload
  dropzone.addEventListener('click', () => fileInput?.click());
  
  // Keyboard accessibility
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput?.click();
    }
  });

  // Enhanced drag and drop events
  let dragCounter = 0;

  // Prevent default drag behaviors on document
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, preventDefaults, false);
    dropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, handleDragEnter, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, handleDragLeave, false);
  });

  function handleDragEnter(e) {
    dragCounter++;
    dropzone.classList.add('dragover');
    
    // Add visual feedback
    const dzText = dropzone.querySelector('.dz-text');
    if (dzText) {
      dzText.innerHTML = '<strong>Drop your image here!</strong>';
    }
    
    // Check if dragged item contains files
    if (e.dataTransfer.items) {
      const hasImageFile = Array.from(e.dataTransfer.items).some(item => 
        item.kind === 'file' && item.type.startsWith('image/')
      );
      
      if (hasImageFile) {
        dropzone.classList.add('valid-drag');
      } else {
        dropzone.classList.add('invalid-drag');
      }
    }
  }

  function handleDragLeave(e) {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropzone.classList.remove('dragover', 'valid-drag', 'invalid-drag');
      
      // Reset text
      const dzText = dropzone.querySelector('.dz-text');
      if (dzText) {
        dzText.innerHTML = '<strong>Click to upload</strong> or drag & drop<span class="dz-sub">PNG or JPG • up to 10MB</span>';
      }
    }
  }

  // Handle dropped files
  dropzone.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    dragCounter = 0;
    dropzone.classList.remove('dragover', 'valid-drag', 'invalid-drag');
    
    // Reset text
    const dzText = dropzone.querySelector('.dz-text');
    if (dzText) {
      dzText.innerHTML = '<strong>Click to upload</strong> or drag & drop<span class="dz-sub">PNG or JPG • up to 10MB</span>';
    }

    const dt = e.dataTransfer;
    const files = dt.files;

    if (files && files.length > 0) {
      // Validate if it's an image file
      const file = files[0];
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      
      if (!validTypes.includes(file.type)) {
        toast('Please drop a valid image file (PNG, JPG, WebP)', 'error');
        shake(dropzone);
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast('Image file is too large. Maximum size is 10MB', 'error');
        shake(dropzone);
        return;
      }

      toast('Image dropped successfully!', 'success');
      handleFiles(files);
    } else {
      toast('No valid image file detected', 'error');
      shake(dropzone);
    }
  }

  // Handle multiple files (take first image only)
  function handleMultipleFiles(files) {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) {
      toast('No image files found in the dropped items', 'error');
      return;
    }

    if (imageFiles.length > 1) {
      toast(`Found ${imageFiles.length} images. Using the first one: ${imageFiles[0].name}`, 'info');
    }

    // Create a new FileList with just the first image
    const dt = new DataTransfer();
    dt.items.add(imageFiles[0]);
    handleFiles(dt.files);
  }
}

// ========== GLOBAL DRAG & DROP HANDLING ==========

// Prevent default drag behaviors and add global drag feedback
let globalDragCounter = 0;

// Handle page-wide drag events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  document.addEventListener(eventName, handleGlobalDrag, false);
});

function handleGlobalDrag(e) {
  // Only handle if it's not already handled by dropzone
  if (e.target.closest('#dropzone')) {
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if (e.type === 'dragenter') {
    globalDragCounter++;
    document.body.classList.add('page-dragover');
    
    // Check if dragged item contains image files
    if (e.dataTransfer.items) {
      const hasImageFile = Array.from(e.dataTransfer.items).some(item => 
        item.kind === 'file' && item.type.startsWith('image/')
      );
      
      if (hasImageFile) {
        document.body.classList.add('dragging-valid');
        if (dropzone) {
          dropzone.style.pointerEvents = 'all';
          dropzone.style.zIndex = '10001';
        }
      } else {
        document.body.classList.add('dragging-invalid');
      }
    }
  } else if (e.type === 'dragleave') {
    globalDragCounter--;
    if (globalDragCounter <= 0) {
      globalDragCounter = 0;
      document.body.classList.remove('page-dragover', 'dragging-valid', 'dragging-invalid');
      if (dropzone) {
        dropzone.style.pointerEvents = '';
        dropzone.style.zIndex = '';
      }
    }
  } else if (e.type === 'drop') {
    globalDragCounter = 0;
    document.body.classList.remove('page-dragover', 'dragging-valid', 'dragging-invalid');
    if (dropzone) {
      dropzone.style.pointerEvents = '';
      dropzone.style.zIndex = '';
    }

    // Handle files dropped outside dropzone
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => 
        file.type.startsWith('image/')
      );

      if (imageFiles.length > 0) {
        toast(`Image dropped! Processing: ${imageFiles[0].name}`, 'success');
        const dt = new DataTransfer();
        dt.items.add(imageFiles[0]);
        handleFiles(dt.files);
      } else {
        toast('Please drop an image file (PNG, JPG, WebP)', 'error');
      }
    }
  }
}

fileInput?.addEventListener('change', (e) => {
  const files = e.target.files;
  if (files && files.length) handleFiles(files);
});

// --- Prompt enhancements ---
// Show Examples functionality
if (showExamplesBtn) {
  showExamplesBtn.addEventListener('click', () => {
    const examples = [
      "Convert to black and white with high contrast",
      "Add warm vintage film effect with grain",
      "Enhance colors and increase saturation",
      "Apply soft gaussian blur for dreamy effect",
      "Sharpen details and increase clarity",
      "Add dramatic shadows and highlights",
      "Create sepia tone vintage look",
      "Apply cool blue tone filter",
      "Increase brightness and reduce noise",
      "Add artistic oil painting effect"
    ];
    
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    if (promptInput) {
      promptInput.value = randomExample;
      updateCounter();
      autoResize();
      toast('Example prompt added', 'info');
    }
  });
}

function updateCounter() {
  const len = (promptInput.value || '').length;
  if (promptCounter) promptCounter.textContent = `${len} chars`;
  const ok = len > 0;
  submitBtn.disabled = !ok;
  requiredHint?.classList.toggle('hidden', ok);
}
// ========== ENHANCED PASTE FROM CLIPBOARD ==========

// Enhanced paste-from-clipboard functionality
document.addEventListener('paste', async (e) => {
  // Prevent default paste behavior
  e.preventDefault();
  
  const items = e.clipboardData?.items || [];
  let imageFound = false;

  for (const item of items) {
    if (item.type && item.type.startsWith('image/')) {
      imageFound = true;
      const file = item.getAsFile();
      
      if (file) {
        // Validate file size
        if (file.size > 10 * 1024 * 1024) {
          toast('Pasted image is too large. Maximum size is 10MB', 'error');
          return;
        }

        // Create a proper filename for pasted image
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const extension = file.type.split('/')[1] || 'png';
        const fileName = `pasted-image-${timestamp}.${extension}`;
        
        // Create a new file with proper name
        const namedFile = new File([file], fileName, { type: file.type });
        
        const dt = new DataTransfer();
        dt.items.add(namedFile);
        
        toast(`Image pasted from clipboard: ${fileName}`, 'success');
        handleFiles(dt.files);
        break;
      }
    }
  }

  if (!imageFound && items.length > 0) {
    // Check if there's a URL that might be an image
    for (const item of items) {
      if (item.type === 'text/plain') {
        try {
          const text = await new Promise((resolve) => {
            item.getAsString(resolve);
          });
          
          // Check if it's an image URL
          if (text.match(/\.(jpg|jpeg|png|gif|webp)$/i) || 
              text.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)/i)) {
            toast('Image URL detected in clipboard. Please download and drop the file instead.', 'info');
            return;
          }
        } catch (error) {
          console.log('Could not read clipboard text:', error);
        }
      }
    }
    
    toast('No image found in clipboard. Try copying an image first.', 'error');
  }
});

// Add keyboard shortcut hints
document.addEventListener('keydown', (e) => {
  // Ctrl+V or Cmd+V hint
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    // Show a brief hint about paste functionality
    const hasClipboardImage = navigator.clipboard && navigator.clipboard.read;
    if (hasClipboardImage) {
      // Visual feedback that paste is being processed
      if (dropzone) {
        dropzone.style.borderColor = '#8B5CF6';
        setTimeout(() => {
          dropzone.style.borderColor = '';
        }, 300);
      }
    }
  }
});

// ========== ADDITIONAL DRAG & DROP ENHANCEMENTS ==========

// Add file validation helper
function validateImageFile(file) {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Please use PNG, JPG, WebP, or GIF.`
    };
  }

  if (file.size > maxSize) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large: ${sizeMB}MB. Maximum size is 10MB.`
    };
  }

  return { valid: true };
}

// Add drag and drop visual feedback helper
function updateDropzoneText(state, fileName = '') {
  const dzText = dropzone?.querySelector('.dz-text');
  if (!dzText) return;

  switch (state) {
    case 'default':
      dzText.innerHTML = '<strong>Click to upload</strong> or drag & drop<span class="dz-sub">PNG or JPG • up to 10MB</span>';
      break;
    case 'dragover':
      dzText.innerHTML = '<strong>Drop your image here!</strong>';
      break;
    case 'valid':
      dzText.innerHTML = '<strong>✓ Drop to upload image</strong>';
      break;
    case 'invalid':
      dzText.innerHTML = '<strong>✗ Invalid file type</strong><span class="dz-sub">Please use PNG, JPG, or WebP</span>';
      break;
    case 'processing':
      dzText.innerHTML = `<strong>Processing: ${fileName}</strong>`;
      break;
  }
}

// Add file size formatter
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Enhanced file info display
function updateFileInfo(file) {
  if (!fileInfo) return;
  
  const size = formatFileSize(file.size);
  const type = file.type.split('/')[1].toUpperCase();
  
  // Get image dimensions
  const img = new Image();
  img.onload = () => {
    fileInfo.innerHTML = `
      <strong>${file.name}</strong><br>
      <span>${img.width} × ${img.height} • ${size} • ${type}</span>
    `;
    fileInfo.classList.add('has-file');
  };
  
  img.onerror = () => {
    fileInfo.innerHTML = `
      <strong>${file.name}</strong><br>
      <span>${size} • ${type}</span>
    `;
    fileInfo.classList.add('has-file');
  };
  
  const url = URL.createObjectURL(file);
  img.src = url;
  
  // Cleanup URL after loading
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Add accessibility announcements for screen readers
function announceToScreenReader(message) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

// Add progress indication for file processing
function showFileProcessing(fileName) {
  updateDropzoneText('processing', fileName);
  announceToScreenReader(`Processing image file: ${fileName}`);
  
  if (dropzone) {
    dropzone.classList.add('processing');
  }
}

function hideFileProcessing() {
  updateDropzoneText('default');
  
  if (dropzone) {
    dropzone.classList.remove('processing');
  }
}
function autoResize() {
  // smooth auto-resize for textarea
  promptInput.style.height = 'auto';
  promptInput.style.height = Math.min(240, Math.max(64, promptInput.scrollHeight)) + 'px';
}
promptInput?.addEventListener('input', () => { 
  updateCounter(); 
  autoResize(); 
  // Save to localStorage
  localStorage.setItem('lastPrompt', promptInput.value);
});
window.addEventListener('load', () => { 
  updateCounter(); 
  autoResize(); 
  // Restore last prompt
  const lastPrompt = localStorage.getItem('lastPrompt');
  if (lastPrompt && !promptInput.value) {
    promptInput.value = lastPrompt;
    updateCounter();
    autoResize();
  }
});

// Update chip active states based on current prompt
function updateChipStates() {
  const currentPrompt = promptInput.value.toLowerCase();
  document.querySelectorAll('.chip').forEach(chip => {
    const chipText = chip.textContent.replace(/^[^\w]*/, '').toLowerCase(); // Remove icon
    chip.classList.toggle('active', currentPrompt.includes(chipText));
  });
}

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
  setProcessingUI(isLoading);
  updateStatus(msg || (isLoading ? 'Processing…' : ''));
  if (isLoading) { progressStart(); } else { progressDone(); }
  // Skeleton state for preview area
  const previewArea = document.querySelector('.preview-area');
  if (isLoading) previewArea?.classList.add('skeleton');
  else previewArea?.classList.remove('skeleton');
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
  setVar('--accent', '#4318FF');
  setVar('--accent-2', '#FF6B6B');
  // Reset local previews
  if (dzPreview) { dzPreview.src = ''; dzPreview.classList.add('hidden'); }
  if (largePreview) largePreview.classList.add('hidden');
  if (dzThumbs) dzThumbs.innerHTML = '';
  if (beforeImg) { beforeImg.src = ''; beforeImg.classList.add('hidden'); }
  hideCompare();
  
  // Hide new UI elements
  if (downloadSection) downloadSection.classList.add('hidden');
  if (comparisonContainer) comparisonContainer.classList.add('hidden');
  resultActions?.classList.add('hidden');
  
  // Reset file info
  fileInfo.textContent = 'No image selected yet';
  fileInfo.classList.remove('has-file');
  
  // Clear localStorage
  localStorage.removeItem('lastPrompt');
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
      shake(promptInput.closest('.form-group'));
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
  updateStatus(`Image upload failed: ${e.message || e}`, 'error');
        shake(dropzone);
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
      shake(statusEl);
      return;
    }
  updateStatus(`Task created (${jobId}). Preparing SSE connection…`, 'processing');
  progressNearDone();
  
    // Dispatch processing start event
    document.dispatchEvent(new CustomEvent('processing-start', {
      detail: { jobId, prompt }
    }));
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
              progressDone();
              toast('Image is ready (SSE)', 'success');
            appearImage();
            if (ENABLE_DYNAMIC_PALETTE) {
              // Derive palette from the resulting image URL
              derivePaletteFromImageURL(out.image_url);
            }
            showCompare();
            setResultActions(outputImg.src);
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              updateStatus('Done (SSE callback)');
            spinner.classList.remove('running');
              progressDone();
              toast('Image is ready (SSE)', 'success');
            appearImage();
            if (ENABLE_DYNAMIC_PALETTE) {
              // Base64 source, still can sample via an Image element
              derivePaletteFromImageURL(outputImg.src);
            }
            showCompare();
            setResultActions(outputImg.src);
          } else {
              updateStatus('Task finished but no image found in output.');
          }
          settled = true;
          setLoading(false);
          es && es.close();
            progressDone();
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
          if (!settled) shake(statusEl);
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
              updateStatus('✅ Image generation completed successfully!', 'success');
              spinner.classList.remove('running');
                progressDone();
                toast('Image is ready', 'success');
              appearImage();
              if (ENABLE_DYNAMIC_PALETTE) derivePaletteFromImageURL(out.image_url);
              showCompare();
              setResultActions(outputImg.src);
          } else if (out?.image_base64) {
            outputImg.src = `data:image/png;base64,${out.image_base64}`;
            outputImg.classList.remove('hidden');
              updateStatus('Done (callback)');
              spinner.classList.remove('running');
                progressDone();
                toast('Image is ready', 'success');
              appearImage();
              if (ENABLE_DYNAMIC_PALETTE) derivePaletteFromImageURL(outputImg.src);
              showCompare();
              setResultActions(outputImg.src);
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
              toast('Task failed', 'error');
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
        toast('Polling error', 'error');
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

// Compare slider helpers
function showCompare() {
  if (!beforeImg?.src || !outputImg?.src) return;
  compareSlider?.classList.remove('hidden');
  compareDivider?.classList.remove('hidden');
  updateCompare();
}
function hideCompare() { compareSlider?.classList.add('hidden'); compareDivider?.classList.add('hidden'); }
function updateCompare() {
  const v = Number(compareSlider?.value || 50);
  const right = 100 - v;
  outputImg.style.clipPath = `inset(0 ${right}% 0 0)`;
  if (compareDivider) compareDivider.style.left = `calc(${v}% - 1px)`;
}
compareSlider?.addEventListener('input', updateCompare);

// Result actions helpers (bind once)
downloadBtn?.addEventListener('click', () => { if (outputImg?.src) downloadImage(outputImg.src); });
openBtn?.addEventListener('click', () => { if (outputImg?.src) window.open(outputImg.src, '_blank'); });
copyUrlBtn?.addEventListener('click', async () => {
  try { if (outputImg?.src) { await navigator.clipboard.writeText(outputImg.src); toast('Copied'); } }
  catch { toast('Copy failed','error'); }
});
function setResultActions(src) {
  if (!src) return;
  
  // Show download section prominently
  if (downloadSection) {
    downloadSection.classList.remove('hidden');
  }
  
  // Show comparison container
  if (comparisonContainer) {
    comparisonContainer.classList.remove('hidden');
  }
  
  // Show other result actions
  if (resultActions) {
    resultActions.classList.remove('hidden');
    const isHttp = /^https?:\/\//i.test(src);
    copyUrlBtn?.classList.toggle('hidden', !isHttp);
  }
  
  // Update comparison slider functionality
  updateCompareSlider();
}
async function downloadImage(src) {
  try {
    const a = document.createElement('a');
    a.href = src; a.download = 'output.png';
    document.body.appendChild(a); a.click(); a.remove();
  } catch { toast('Download failed','error'); }
}

// Keyboard shortcuts: Cmd/Ctrl+Enter to submit, Esc to clear
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    form?.requestSubmit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    clearBtn?.click();
  }
});

// Mobile sticky action bar
function updateStickyActions() {
  if (window.innerWidth <= 640) {
    const formRect = form.getBoundingClientRect();
    const shouldShow = formRect.bottom < window.innerHeight - 100;
    stickyActions?.classList.toggle('show', shouldShow);
    stickyActions?.classList.remove('hidden');
  } else {
    stickyActions?.classList.add('hidden');
    stickyActions?.classList.remove('show');
  }
}

// Wire up sticky submit button
stickySubmit?.addEventListener('click', () => form?.requestSubmit());

// Listen for scroll and resize
window.addEventListener('scroll', updateStickyActions);
window.addEventListener('resize', updateStickyActions);
window.addEventListener('load', updateStickyActions);

// Helper: fade status text on change with enhanced styling
let lastStatus = '';
function updateStatus(text, type = 'info') {
  if (text === undefined || text === null) text = '';
  if (statusEl.textContent !== text) {
    statusEl.textContent = text;
    
    // Remove previous status classes
    statusEl.classList.remove('processing', 'success', 'error', 'status-change');
    
    // Add new status type class
    if (type === 'processing') {
      statusEl.classList.add('processing');
    } else if (type === 'success') {
      statusEl.classList.add('success');
    } else if (type === 'error') {
      statusEl.classList.add('error');
    }
    
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
