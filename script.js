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
    spinner.classList.toggle('running', loading);
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
  
  console.log('Form validation:');
  console.log('- Prompt:', prompt);
  console.log('- Has file:', hasFile);
  console.log('- File count:', fileInput?.files?.length || 0);
  if (hasFile) {
    console.log('- File details:', {
      name: fileInput.files[0].name,
      type: fileInput.files[0].type,
      size: fileInput.files[0].size
    });
  }
  
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
    
    // Upload image if provided
    if (hasFile) {
      updateStatus('Uploading image...');
      console.log('File detected for upload:', fileInput.files[0].name, 'Size:', fileInput.files[0].size);
      
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      
      const uploadResponse = await fetch('/api/upload-temp-image', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
      }
      
      const uploadResult = await uploadResponse.json();
      imageUrl = uploadResult.url;
      console.log('Image uploaded successfully. URL:', imageUrl);
      updateStatus('Image uploaded. Creating AI task...');
    } else {
      console.log('No file selected - generating from prompt only');
    }
    
    // Prepare API payload
    const payload = {
      model: 'google/nano-banana-edit',
      input: {
        prompt: prompt,
        output_format: 'png',
        image_size: '1:1',
        num_outputs: 1
      }
    };
    
    // Add image URL if provided
    if (imageUrl) {
      payload.input.image_urls = [imageUrl];
      console.log('Image URL added to payload:', imageUrl);
    }
    
    updateStatus('Creating AI task...');
    console.log('Sending request to API with payload:', JSON.stringify(payload, null, 2));
    
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
      console.log('Status data structure:', JSON.stringify(status, null, 2));
      
      if (status.status === 'completed' || status.output) {
        const output = status.output || status.raw?.output || status.raw?.data?.output;
        console.log('Extracted output:', output);
        
        if (output?.image_url) {
          console.log('Found image_url:', output.image_url);
          setLoading(false);
          showResult(output.image_url);
          updateStatus('✅ Image generation completed!', 'success');
          toast('Image generated successfully!', 'success');
        } else if (output?.image_base64) {
          console.log('Found image_base64, length:', output.image_base64.length);
          const dataUrl = `data:image/png;base64,${output.image_base64}`;
          setLoading(false);
          showResult(dataUrl);
          updateStatus('✅ Image generation completed!', 'success');
          toast('Image generated successfully!', 'success');
        } else {
          console.error('No image found in output. Available fields:', Object.keys(output || {}));
          throw new Error('No image found in result');
        }
        
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
  if (!imageUrl) return;
  
  console.log('Showing result with URL:', imageUrl);
  
  // Get image containers
  const resultImg = document.getElementById('resultImg');
  const resultImageContainer = document.getElementById('resultImageContainer');
  const comparisonContainer = document.getElementById('comparisonContainer');
  
  // Always use standalone result view for full display
  if (resultImg && resultImageContainer) {
    resultImg.src = imageUrl;
    resultImg.classList.remove('hidden');
    resultImageContainer.classList.remove('hidden');
    
    // Hide comparison container
    if (comparisonContainer) {
      comparisonContainer.classList.add('hidden');
    }
    
    console.log('Showing full result view');
  }
  
  // Show result actions
  const resultActions = document.getElementById('resultActions');
  if (resultActions) {
    resultActions.classList.remove('hidden');
  }
  
  // Show download section
  const downloadSection = document.getElementById('downloadSection');
  if (downloadSection) {
    downloadSection.classList.remove('hidden');
  }
  
  // Hide all loading elements
  const spinner = document.getElementById('spinner');
  const progressBar = document.getElementById('progressBar');
  
  if (spinner) {
    spinner.classList.add('hidden');
    spinner.classList.remove('running');
  }
  
  if (progressBar) {
    progressBar.classList.add('hidden');
  }
  
  console.log('Result displayed successfully:', imageUrl);
}

// Force download image function
async function downloadImage(imageUrl) {
  try {
    console.log('Starting download for:', imageUrl);
    
    // Show downloading status
    updateStatus('Downloading image...', 'info');
    
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    // Get the blob
    const blob = await response.blob();
    
    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    link.download = `ai-generated-image-${timestamp}.png`;
    
    // Force download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    window.URL.revokeObjectURL(url);
    
    console.log('Download completed successfully');
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}

function clearAll() {
  if (form) form.reset();
  
  // Hide all image containers  
  const resultImg = document.getElementById('resultImg');
  const comparisonContainer = document.getElementById('comparisonContainer');
  const resultImageContainer = document.getElementById('resultImageContainer');
  const resultActions = document.getElementById('resultActions');
  const downloadSection = document.getElementById('downloadSection');
  
  if (resultImg) resultImg.classList.add('hidden');
  if (comparisonContainer) comparisonContainer.classList.add('hidden');
  if (resultImageContainer) resultImageContainer.classList.add('hidden');
  if (resultActions) resultActions.classList.add('hidden');
  if (downloadSection) downloadSection.classList.add('hidden');
  
  // Clear file preview
  clearFilePreview();
  
  updateStatus('');
  setLoading(false);
  console.log('Form cleared');
}

// File handling functions
function setupDragAndDrop() {
  const dropzone = document.getElementById('dropzone');
  if (!dropzone) return;
  
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const highlight = () => dropzone.classList.add('dragover');
  const unhighlight = () => dropzone.classList.remove('dragover');
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });
  
  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, unhighlight, false);
  });
  
  // Handle dropped files
  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, false);
  
  // Handle click to upload
  dropzone.addEventListener('click', () => {
    fileInput?.click();
  });
}

function handleFileSelect(file) {
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    toast('Please select a valid image file (PNG, JPG, JPEG)', 'error');
    return;
  }
  
  // Validate file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    toast('File size must be less than 10MB', 'error');
    return;
  }
  
  // Update file input
  if (fileInput) {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
  }
  
  showFilePreview(file);
  toast('Image uploaded successfully', 'success');
  console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
}

function showFilePreview(file) {
  if (!file || !file.type.startsWith('image/')) return;
  
  const dropzone = document.getElementById('dropzone');
  const dzPreview = document.getElementById('dzPreview');
  const dzThumbs = document.getElementById('dzThumbs');
  const largePreview = document.getElementById('largePreview');
  const largePreviewImg = document.getElementById('largePreviewImg');
  const previewFilename = document.getElementById('previewFilename');
  const fileInfo = document.getElementById('fileInfo');
  
  const url = URL.createObjectURL(file);
  
  // Show main preview in dropzone
  if (dzPreview) {
    dzPreview.src = url;
    dzPreview.classList.remove('hidden');
  }
  
  // Show large preview
  if (largePreview && largePreviewImg && previewFilename) {
    largePreviewImg.src = url;
    previewFilename.textContent = file.name;
    largePreview.classList.remove('hidden');
  }
  
  // Add thumbnail to dropzone
  if (dzThumbs) {
    dzThumbs.innerHTML = '';
    const thumb = document.createElement('img');
    thumb.src = url;
    thumb.alt = 'thumbnail';
    thumb.className = 'dz-thumb';
    dzThumbs.appendChild(thumb);
  }
  
  // Update file info
  if (fileInfo) {
    const sizeKB = Math.round(file.size / 1024);
    fileInfo.innerHTML = `
      <span class="file-name">${file.name}</span>
      <span class="file-size">${sizeKB} KB</span>
    `;
  }
  
  // Update dropzone appearance
  if (dropzone) {
    const dzText = dropzone.querySelector('.dz-text');
    if (dzText) {
      dzText.innerHTML = `<strong>✓ ${file.name}</strong><span class="dz-sub">Click to change image</span>`;
    }
  }
  
  console.log('File preview shown for:', file.name);
}

function clearFilePreview() {
  const dzPreview = document.getElementById('dzPreview');
  const dzThumbs = document.getElementById('dzThumbs');
  const largePreview = document.getElementById('largePreview');
  const fileInfo = document.getElementById('fileInfo');
  const dropzone = document.getElementById('dropzone');
  
  // Clear previews
  if (dzPreview) dzPreview.classList.add('hidden');
  if (largePreview) largePreview.classList.add('hidden');
  if (dzThumbs) dzThumbs.innerHTML = '';
  
  // Reset file info
  if (fileInfo) {
    fileInfo.textContent = 'No image selected yet';
  }
  
  // Reset dropzone text
  if (dropzone) {
    const dzText = dropzone.querySelector('.dz-text');
    if (dzText) {
      dzText.innerHTML = '<strong>Click to upload</strong><span class="dz-sub">PNG or JPG • up to 10MB</span>';
    }
  }
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
  
  // Download button event listener
  const downloadBtn = document.getElementById('downloadBtn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      const resultImg = document.getElementById('resultImg');
      
      if (resultImg && !resultImg.classList.contains('hidden') && resultImg.src) {
        try {
          await downloadImage(resultImg.src);
          toast('Download completed!', 'success');
        } catch (error) {
          console.error('Download failed:', error);
          toast('Download failed', 'error');
        }
      } else {
        toast('No image to download', 'error');
      }
    });
  }
  
  // Open button event listener
  const openBtn = document.getElementById('openBtn');
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const resultImg = document.getElementById('resultImg');
      
      if (resultImg && !resultImg.classList.contains('hidden') && resultImg.src) {
        window.open(resultImg.src, '_blank');
        toast('Image opened in new tab', 'success');
      } else {
        toast('No image to open', 'error');
      }
    });
  }
  
  // Copy URL button event listener
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener('click', async () => {
      const resultImg = document.getElementById('resultImg');
      
      if (resultImg && !resultImg.classList.contains('hidden') && resultImg.src) {
        try {
          await navigator.clipboard.writeText(resultImg.src);
          toast('Image URL copied to clipboard', 'success');
        } catch (error) {
          console.error('Copy failed:', error);
          toast('Failed to copy URL', 'error');
        }
      } else {
        toast('No image URL to copy', 'error');
      }
    });
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
        handleFileSelect(file);
      }
    });
  }
  
  // Setup drag and drop
  setupDragAndDrop();
  
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