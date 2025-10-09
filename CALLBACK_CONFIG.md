# 🔄 Callback URL Configuration Guide

## 📋 **Ringkasan Masalah**

Ketika Anda mengganti domain, **API AI eksternal** (seperti KIE.ai) perlu tahu domain baru Anda untuk mengirim callback hasil pemrosesan.

## 🚀 **Solusi Otomatis vs Manual**

### 🤖 **1. Auto-Detection (Default)**

Aplikasi Anda sudah pintar mendeteksi domain secara otomatis:

```python
# Kode ini otomatis detect domain dari request:
scheme = hdr.get("x-forwarded-proto") or request.url.scheme or "https"
host = hdr.get("x-forwarded-host") or hdr.get("host") or request.url.netloc
cb_url = f"{scheme}://{host}/api/kie/callback"
```

**✅ Keuntungan:**

- Otomatis update saat ganti domain
- Tidak perlu konfigurasi manual
- Cocok untuk development dan testing

**⚠️ Limitasi:**

- Bergantung pada headers yang benar
- Mungkin tidak akurat di beberapa proxy/CDN

### 🔧 **2. Manual Configuration (Recommended untuk Production)**

Untuk production, sebaiknya set manual di file `.env`:

```bash
# .env
KIE_API_KEY=your_actual_kie_api_key
KIE_CALLBACK_URL=https://yourdomain.com/api/kie/callback
KIE_CALLBACK_TOKEN=your_security_token
```

## 📝 **Langkah-langkah Setup**

### **Step 1: Buat file .env**

```bash
cp .env.example .env
```

### **Step 2: Konfigurasi sesuai environment**

#### **🏠 Development (Local):**

```bash
# .env
KIE_API_KEY=your_kie_api_key
KIE_CALLBACK_URL=http://localhost:8000/api/kie/callback
KIE_CALLBACK_TOKEN=dev_token_123
```

#### **🌐 Production:**

```bash
# .env
KIE_API_KEY=your_production_kie_api_key
KIE_CALLBACK_URL=https://yourdomain.com/api/kie/callback
KIE_CALLBACK_TOKEN=super_secure_production_token
```

#### **☁️ Platform Deployment:**

**Vercel:**

```bash
KIE_CALLBACK_URL=https://yourapp.vercel.app/api/kie/callback
```

**Railway:**

```bash
KIE_CALLBACK_URL=https://yourapp.railway.app/api/kie/callback
```

**Netlify:**

```bash
KIE_CALLBACK_URL=https://yourapp.netlify.app/api/kie/callback
```

**Custom Domain:**

```bash
KIE_CALLBACK_URL=https://yourdomain.com/api/kie/callback
```

## 🔒 **Security Best Practices**

### **1. Gunakan HTTPS di Production**

```bash
# ✅ Good
KIE_CALLBACK_URL=https://yourdomain.com/api/kie/callback

# ❌ Bad (untuk production)
KIE_CALLBACK_URL=http://yourdomain.com/api/kie/callback
```

### **2. Set Security Token**

```bash
# Generate random token untuk security
KIE_CALLBACK_TOKEN=$(openssl rand -hex 32)
```

### **3. Environment-specific Configuration**

```bash
# Development
KIE_CALLBACK_URL=http://localhost:8000/api/kie/callback
KIE_CALLBACK_TOKEN=dev_token

# Staging
KIE_CALLBACK_URL=https://staging.yourdomain.com/api/kie/callback
KIE_CALLBACK_TOKEN=staging_secure_token

# Production
KIE_CALLBACK_URL=https://yourdomain.com/api/kie/callback
KIE_CALLBACK_TOKEN=production_ultra_secure_token
```

## 🧪 **Testing Callback URL**

### **1. Preview Callback URL**

```bash
curl https://yourdomain.com/api/kie/preview-callback
```

Response:

```json
{
  "autoCallbackUrl": "https://yourdomain.com/api/kie/callback?token=your_token"
}
```

### **2. Test Callback Endpoint**

```bash
curl -X POST https://yourdomain.com/api/kie/callback?token=your_token \
  -H "Content-Type: application/json" \
  -d '{"test": "callback"}'
```

## 🔄 **Deployment Workflow**

### **Ketika Ganti Domain:**

1. **Update .env file:**

   ```bash
   # Ganti domain lama
   KIE_CALLBACK_URL=https://domain-baru.com/api/kie/callback
   ```

2. **Deploy aplikasi ke domain baru**

3. **Test callback URL:**

   ```bash
   curl https://domain-baru.com/api/kie/preview-callback
   ```

4. **Verify dengan KIE.ai dashboard** (jika ada)

## 📊 **Environment Variables Summary**

| Variable             | Required    | Description         | Example                                   |
| -------------------- | ----------- | ------------------- | ----------------------------------------- |
| `KIE_API_KEY`        | ✅ Yes      | API key dari KIE.ai | `kie_abc123...`                           |
| `KIE_CALLBACK_URL`   | 🔶 Optional | Manual callback URL | `https://yourdomain.com/api/kie/callback` |
| `KIE_CALLBACK_TOKEN` | 🔶 Optional | Security token      | `random_secure_token_here`                |
| `AI_API_URL`         | ❌ No       | External AI API URL | `https://api.other-ai.com/v1/generate`    |
| `AI_API_KEY`         | ❌ No       | External AI API key | `other_ai_key_123`                        |

## 🚨 **Common Issues & Solutions**

### **Issue 1: Callback tidak diterima**

```bash
# Check if callback URL accessible
curl https://yourdomain.com/api/kie/callback

# Check logs untuk error
tail -f app.log
```

### **Issue 2: Wrong domain di callback**

```bash
# Set manual callback URL
KIE_CALLBACK_URL=https://correct-domain.com/api/kie/callback
```

### **Issue 3: SSL certificate error**

```bash
# Pastikan HTTPS certificate valid
curl -I https://yourdomain.com/api/kie/callback
```

## 🎯 **Rekomendasi**

### **🏠 Development:**

- Gunakan auto-detection
- Set `KIE_CALLBACK_URL=http://localhost:8000/api/kie/callback`

### **🌐 Production:**

- **Selalu set manual** `KIE_CALLBACK_URL`
- Gunakan HTTPS
- Set security token
- Test setelah deployment

### **☁️ Multi-environment:**

- Buat `.env` terpisah per environment
- Gunakan CI/CD untuk manage environment variables
- Monitor callback success rate

---

**💡 Kesimpulan:** Untuk **production dan domain changes**, selalu set `KIE_CALLBACK_URL` secara manual di environment variables agar API AI bisa mengirim callback ke domain yang benar.
