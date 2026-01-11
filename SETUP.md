# ContentHosting.org - Complete Setup Guide

This guide walks you through setting up your self-hosted video/image embed system from scratch.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- [Cloudflare account](https://cloudflare.com/) with domain connected
- [Backblaze B2 account](https://www.backblaze.com/b2/cloud-storage.html) (free tier: 10GB)
- Git for version control

---

## Step 1: Backblaze B2 Setup

### 1.1 Create a B2 Bucket

1. Log in to [Backblaze B2](https://secure.backblaze.com/b2_buckets.htm)
2. Click **"Create a Bucket"**
3. Configure:
   - **Bucket Name**: `contenthosting-media` (must be globally unique)
   - **Files in Bucket are**: Choose one:
     - **Public** ✅ (Recommended - simpler, works without signed URLs)
     - **Private** (More secure, requires signed URLs for every file access)
   - **Default Encryption**: None (or Server-Side if preferred)
   - **Object Lock**: Disabled
4. Click **"Create a Bucket"**

### 1.2 Note Your Bucket Info

After creating the bucket, note these values:
- **Bucket Name**: `contenthosting-media`
- **Endpoint**: e.g., `s3.us-west-004.backblazeb2.com`
- **Region**: e.g., `us-west-004`
- **Friendly URL** (for public buckets): `https://f004.backblazeb2.com/file/contenthosting-media/`

### 1.3 Create Application Key

1. Go to **App Keys** in B2 sidebar
2. Click **"Add a New Application Key"**
3. Configure:
   - **Name**: `contenthosting-api`
   - **Allow access to Bucket(s)**: Select your bucket
   - **Type of Access**: Read and Write
   - **Allow List All Bucket Names**: Yes (recommended)
   - **File name prefix**: Leave empty
4. Click **"Create New Key"**
5. **IMPORTANT**: Copy and save immediately:
   - **keyID**: e.g., `004abc123def456...`
   - **applicationKey**: e.g., `K004xyz789...` (shown only once!)

### 1.4 S3-Compatible Credentials Summary

```
B2_KEY_ID=004xxxxxxxxxxxx000000001
B2_APP_KEY=K004xxxxxxxxxxxxxxxxxxxxxxxxxxx
B2_BUCKET=contenthosting-media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
```

### 1.5 CORS Configuration (Required for Browser Uploads)

1. Go to **Bucket Settings** → **CORS Rules**
2. Add this CORS configuration:

```json
[
  {
    "corsRuleName": "contenthosting-uploads",
    "allowedOrigins": [
      "https://contenthosting.org",
      "http://localhost:8788"
    ],
    "allowedOperations": [
      "s3_put",
      "s3_get",
      "s3_head"
    ],
    "allowedHeaders": [
      "authorization",
      "content-type",
      "content-length",
      "x-amz-date",
      "x-amz-content-sha256"
    ],
    "exposeHeaders": [
      "ETag",
      "x-amz-version-id"
    ],
    "maxAgeSeconds": 3600
  }
]
```

3. Save the CORS configuration

---

## Step 2: Cloudflare Configuration

### 2.1 Create Workers KV Namespace

1. Go to Cloudflare Dashboard → **Workers & Pages** → **KV**
2. Click **"Create a namespace"**
3. Name it: `contenthosting-kv`
4. Click **Create**
5. **Copy the Namespace ID** (you'll need this for wrangler.toml)

### 2.2 (Optional) Set Up Media Subdomain

For bandwidth efficiency (Cloudflare Bandwidth Alliance = FREE egress from B2):

1. Go to **DNS** in Cloudflare dashboard
2. Add a new CNAME record:
   - **Type**: CNAME
   - **Name**: `media`
   - **Target**: `f004.backblazeb2.com` (your B2 endpoint)
   - **Proxy status**: **DNS only (grey cloud)** ⚠️ IMPORTANT
   - **TTL**: Auto
3. Click **Save**

> ⚠️ **Why DNS-only (grey cloud)?**
> Cloudflare's Terms of Service prohibit proxying video content through their CDN on free/pro plans. Using DNS-only mode ensures compliance while still benefiting from the Bandwidth Alliance (free B2 egress to Cloudflare).

---

## Step 3: Local Project Setup

### 3.1 Clone/Initialize Project

```bash
cd contenthosting.org
npm install
```

### 3.2 Create Environment Variables File

Create `.dev.vars` in the project root (this file is gitignored):

```bash
# .dev.vars - Local development secrets

# Backblaze B2 Credentials
B2_KEY_ID=004abc123def456789
B2_APP_KEY=K004xyz789yourSecretKeyHere
B2_BUCKET=contenthosting-media
B2_REGION=us-west-004
B2_ENDPOINT=s3.us-west-004.backblazeb2.com

# Admin Password Hash (see Step 3.3)
ADMIN_PASSWORD_HASH=your_sha256_hash_here
```

### 3.3 Generate Admin Password Hash

Run the password hash utility:

```bash
npm run hash-password
```

Enter your desired password when prompted. Copy the SHA-256 hash and paste it into:
1. `.dev.vars` for local development
2. Cloudflare Dashboard for production (see Step 4)

**Example:**
```
Enter password to hash: MySecretPassword123

=== Password Hash ===
SHA-256: 5e884898da28047d55d4c14f6c9a0b37e23e5b6b9c0d...

Add this to your environment variables as ADMIN_PASSWORD_HASH
```

### 3.4 Update wrangler.toml

Edit `wrangler.toml` with your actual KV namespace ID:

```toml
name = "contenthosting"
compatibility_date = "2024-01-01"
pages_build_output_dir = "public"

[[kv_namespaces]]
binding = "CONTENT_KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"
```

---

## Step 4: Cloudflare Production Secrets

### 4.1 Set Environment Variables in Cloudflare

1. Go to Cloudflare Dashboard → **Workers & Pages**
2. Select your **contenthosting** project
3. Go to **Settings** → **Environment variables**
4. Add these variables (use "Encrypt" for secrets):

| Variable | Value | Type |
|----------|-------|------|
| `B2_KEY_ID` | Your B2 key ID | Encrypted |
| `B2_APP_KEY` | Your B2 application key | Encrypted |
| `B2_BUCKET` | `contenthosting-media` | Plain text |
| `B2_REGION` | `us-west-004` | Plain text |
| `B2_ENDPOINT` | `s3.us-west-004.backblazeb2.com` | Plain text |
| `ADMIN_PASSWORD_HASH` | Your SHA-256 hash | Encrypted |

### 4.2 Bind KV Namespace

1. In the same Settings page, go to **Functions** → **KV namespace bindings**
2. Add binding:
   - **Variable name**: `CONTENT_KV`
   - **KV namespace**: Select `contenthosting-kv`
3. Save

---

## Step 5: Deploy

### 5.1 Test Locally First

```bash
npm run dev
```

This starts a local server at `http://localhost:8788`.

Test the full flow:
1. Go to `http://localhost:8788/admin`
2. Log in with your password
3. Upload a test file
4. Verify it appears in the file list
5. Test embed URL in a new tab

### 5.2 Deploy to Cloudflare Pages

**Option A: Via Git (Recommended)**

If connected to GitHub, just push:

```bash
git add .
git commit -m "Setup complete"
git push origin main
```

Cloudflare Pages will auto-deploy.

**Option B: Direct Deploy**

```bash
npm run deploy
```

### 5.3 Verify Production

1. Visit `https://contenthosting.org/admin`
2. Log in with your password
3. Upload a test file
4. Test the embed URL: `https://contenthosting.org/embed/{fileId}`

---

## Step 6: Testing

### Test the Complete Flow

1. **Login Test**: Go to `/admin`, enter password
2. **Upload Test**: Select MP4/image, click Upload
3. **List Test**: File should appear in the list
4. **Embed Test**: Copy embed URL, open in new tab
5. **Delete Test**: Delete a file, verify removal

### Test Embed in HTML

```html
<!DOCTYPE html>
<html>
<head><title>Embed Test</title></head>
<body>
  <h1>Testing Embed</h1>
  <iframe 
    src="https://contenthosting.org/embed/YOUR_FILE_ID" 
    width="100%" 
    height="450" 
    frameborder="0" 
    allowfullscreen>
  </iframe>
</body>
</html>
```

---

## Handling Large Files (>100MB)

Your setup supports files up to **500MB** because:

1. **Browser uploads directly to B2** - bypasses Cloudflare Worker's 100MB body limit
2. **Presigned URLs** - Worker only generates URLs, doesn't proxy file data

### For files >500MB:
- Increase the `maxSize` limit in `functions/api/upload-url.js`
- Consider implementing multipart uploads for files >5GB
- Backblaze B2 supports files up to 10TB with multipart

---

## Troubleshooting

### "Failed to get upload URL"
- **Cause**: B2 credentials incorrect or missing
- **Fix**: Verify `B2_KEY_ID` and `B2_APP_KEY` in environment variables

### CORS Errors During Upload
- **Cause**: B2 CORS rules not configured
- **Fix**: Add CORS rules as shown in Step 1.5

### "Invalid password"
- **Cause**: Password hash mismatch
- **Fix**: Regenerate hash with `npm run hash-password` and update env vars

### Embed Page Shows "Media not found"
- **Cause**: File metadata not in KV
- **Fix**: Try re-uploading the file

### Large Files Fail (>100MB)
- **Cause**: Network timeout
- **Fix**: Ensure stable connection; files upload directly to B2

### Video Won't Play
- **Cause**: Signed URL expired
- **Fix**: Refresh embed page (generates new URL)

---

## Security & ToS Notes

### Security Best Practices

1. **Never commit `.dev.vars`** - It's gitignored by default
2. **Use strong admin password** - 20+ characters recommended
3. **Keep DNS-only (grey cloud)** on media subdomain
4. **Rotate B2 keys periodically** - Every 90 days
5. **Monitor B2 usage** - Set up alerts for unexpected usage

### Cloudflare ToS Compliance

- ✅ **Media subdomain DNS-only**: Video traffic bypasses Cloudflare proxy
- ✅ **Main site proxied**: HTML pages served through Cloudflare CDN
- ✅ **Bandwidth Alliance**: Free egress from B2 to Cloudflare network

### Public vs Private Bucket

| Feature | Public Bucket | Private Bucket |
|---------|--------------|----------------|
| Setup complexity | Simple | More complex |
| File access | Direct URL | Signed URL required |
| Security | Anyone with URL can access | Time-limited access |
| Recommended for | Public content | Sensitive content |

---

## Bandwidth Alliance Benefits

When using Cloudflare with Backblaze B2:

| Traffic Path | Cost |
|--------------|------|
| B2 → Cloudflare (Bandwidth Alliance) | **FREE** |
| Cloudflare → Visitor | **FREE** |

Result: Zero egress fees when properly configured!

---

## Quick Reference

### URLs
- Admin: `https://contenthosting.org/admin`
- Embed: `https://contenthosting.org/embed/{fileId}`
- API: `https://contenthosting.org/api/*`

### Commands
```bash
npm run dev          # Start local development
npm run deploy       # Deploy to Cloudflare
npm run hash-password # Generate password hash
```

### Environment Variables
```bash
B2_KEY_ID            # Backblaze B2 key ID
B2_APP_KEY           # Backblaze B2 application key
B2_BUCKET            # Bucket name
B2_REGION            # e.g., us-west-004
B2_ENDPOINT          # e.g., s3.us-west-004.backblazeb2.com
ADMIN_PASSWORD_HASH  # SHA-256 hash of admin password
```
