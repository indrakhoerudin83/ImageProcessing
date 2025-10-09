// AI Image Processing - Fixed Form Submission
console.log('Script loaded');

// DOM Elements
const form = document.getElementById('aiForm');
const fileInput = document.getElementById('file');
const promptInput = document.getElementById('prompt');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const spinner = document.getElementById('spinner');
const outputImg = document.getElementById('outputImg');
const statusEl = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const toastContainer = document.getElementById('toastContainer');

// Global state
let isProcessing = false;

// Utility Functions
function updateStatus(message, type = 'info') {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status enhanced-status ${type}`;
  }
  console.log(`Status: ${message}`);
}

function setLoading(loading) {
  isProcessing = loading;
  
  if (submitBtn) {
    submitBtn.disabled = loading;
    const btnText = submitBtn.querySelector('.btn-text');
    if (btnText) {
      btnText.textContent = loading ? 'Generating...' : 'Generate with AI';
    }
    submitBtn.classList.toggle('processing', loading);
  }
  
  if (spinner) {
    spinner.classList.toggle('hidden', !loading);
  }
  
  if (progressBar) {
    progressBar.classList.toggle('hidden', !loading);
  }
}

function toast(message, type = 'info') {
  if (!toastContainer) return;
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast toast-${type}`;
  toastEl.textContent = message;
  
  toastContainer.appendChild(toastEl);
  
  setTimeout(() => toastEl.classList.add('show'), 100);
  
  setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.remove(), 300);
  }, 3000);
}

// Main form submission handler
async function handleFormSubmit(e) {
  e.preventDefault();
  e.stopPropagation();
  
  console.log('Form submitted - preventing page refresh');
  
  if (isProcessing) {
    console.log('Already processing, ignoring submission');
    return;
  }
  
  const prompt = promptInput?.value?.trim();
  const hasFile = fileInput?.files && fileInput.files.length > 0;
  
  if (!prompt) {
    updateStatus('Prompt is required', 'error');
    toast('Please enter a prompt', 'error');
    if (promptInput) promptInput.focus();
    return;
  }
  
  try {
    setLoading(true);
    updateStatus('Starting AI generation...');
    
    let imageUrl = '';
    
    if (hasFile) {
      updateStatus('Uploading image...');
      
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      
      const uploadResponse = await fetch('/api/upload-temp-image', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }
      
      const uploadResult = await uploadResponse.json();
      imageUrl = uploadResult.url;
      console.log('Image uploaded:', imageUrl);
    }
    
    const payload = {
      model: 'google/nano-banana',
      input: {
        prompt,
        output_format: 'png',
        image_size: '1:1'
      }
    };
    
    if (imageUrl) {
      payload.input.image_urls = [imageUrl];
    }
    
    updateStatus('Creating AI task...');
    console.log('Sending request to API:', payload);
    
    const response = await fetch('/api/kie/create-task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('API response received:', result);
    
    const jobId = result?.data?.taskId || result?.data?.id || result?.taskId || result?.id;
    
    if (!jobId) {
      throw new Error('Job ID not found in response');
    }
    
    updateStatus(`Task created (${jobId}). Waiting for result...`);
    await pollForResult(jobId);
    
  } catch (error) {
    console.error('Form submission error:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    toast(`Error: ${error.message}`, 'error');
    setLoading(false);
  }
}

async function pollForResult(jobId) {
  const maxAttempts = 150;
  const interval = 2000;
  let attempts = 0;
  
  updateStatus('Generating with AI...');
  
  const poll = async () => {
    attempts++;
    
    try {
      const response = await fetch(`/api/kie/result?job_id=${encodeURIComponent(jobId)}`);
      
      if (!response.ok) {
        throw new Error(`Poll failed: ${response.status}`);
      }
      
      const status = await response.json();
      console.log('Poll result:', status);
      
      if (status.status === 'completed' || status.output) {
        const output = status.output || status.raw?.output || status.raw?.data?.output;
        
        if (output?.image_url) {
          showResult(output.image_url);
          updateStatus('✅ Image generation completed!', 'success');
          toast('Image generated successfully!', 'success');
        } else if (output?.image_base64) {
          const dataUrl = `data:image/png;base64,${output.image_base64}`;
          showResult(dataUrl);
          updateStatus('✅ Image generation completed!', 'success');
          toast('Image generated successfully!', 'success');
        } else {
          throw new Error('No image found in result');
        }
        
        setLoading(false);
        return;
      } else if (status.status === 'failed') {
        throw new Error('AI task failed');
      } else {
        updateStatus(`AI processing... (${status.status || 'pending'})`);
        
        if (attempts < maxAttempts) {
          setTimeout(poll, interval);
        } else {
          throw new Error('Timeout waiting for result');
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      updateStatus(`Error: ${error.message}`, 'error');
      toast(`Error: ${error.message}`, 'error');
      setLoading(false);
    }
  };
  
  setTimeout(poll, interval);
}

function showResult(imageUrl) {
  if (!outputImg || !imageUrl) return;
  
  outputImg.src = imageUrl;
  outputImg.classList.remove('hidden');
  console.log('Result displayed:', imageUrl);
}

function clearAll() {
  if (form) form.reset();
  if (outputImg) outputImg.classList.add('hidden');
  updateStatus('');
  setLoading(false);
  console.log('Form cleared');
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, setting up event listeners');
  
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
    console.log('Form submit handler attached to #aiForm');
  } else {
    console.error('Form element #aiForm not found');
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearAll);
  }
  
  const promptCounter = document.getElementById('promptCounter');
  if (promptInput && promptCounter) {
    promptInput.addEventListener('input', () => {
      promptCounter.textContent = `${promptInput.value.length} chars`;
    });
  }
  
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) {
        console.log('File selected:', file.name);
        toast('File selected: ' + file.name, 'success');
      }
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (form && !isProcessing) {
        console.log('Keyboard shortcut triggered form submission');
        form.dispatchEvent(new Event('submit'));
      }
    }
    
    if (e.key === 'Escape') {
      clearAll();
    }
  });
  
  console.log('All event listeners set up successfully');
});

window.addEventListener('load', () => {
  console.log('Page fully loaded');
  
  if (form) {
    console.log('Form found:', form);
  }
  
  if (submitBtn) {
    submitBtn.addEventListener('click', (e) => {
      console.log('Submit button clicked');
      if (form) {
        e.preventDefault();
        handleFormSubmit(e);
      }
    });
  }
});