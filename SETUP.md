# Setup Instructions

Complete step-by-step guide to deploy ContentHosting.org

---

## Prerequisites

- Cloudflare account (free tier works)
- Backblaze B2 account (free tier: 10GB storage)
- Domain: contenthosting.org (or your own domain)
- Node.js 18+ installed locally
- Git installed

---

## Step 1: Add Domain to Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **"Add a Site"**
3. Enter: `contenthosting.org`
4. Select **Free plan**
5. Cloudflare will scan existing DNS records
6. Update your domain registrar's nameservers to Cloudflare's:
   - Usually something like: `xxx.ns.cloudflare.com`
7. Wait for DNS propagation (can take up to 24 hours)

---

## Step 2: Create Backblaze B2 Bucket

1. Sign up at [Backblaze B2](https://www.backblaze.com/b2/sign-up.html)
2. Go to **"Buckets"** → **"Create a Bucket"**
3. Configure:
   - **Bucket Name**: `contenthosting-media` (must be globally unique, add random suffix if taken)
   - **Files in Bucket**: **Private**
   - **Default Encryption**: None (optional)
   - **Object Lock**: Disabled
4. Click **"Create a Bucket"**
5. Note down:
   - **Bucket Name**: `contenthosting-media`
   - **Endpoint**: `s3.us-west-004.backblazeb2.com` (varies by region)
   - **Bucket ID**: Found in bucket details

### Create Application Key

1. Go to **"App Keys"** → **"Add a New Application Key"**
2. Configure:
   - **Name**: `contenthosting-key`
   - **Allow access to Bucket**: Select your bucket
   - **Type of Access**: **Read and Write**
   - **Allow List All Bucket Names**: ✓ Check this
   - **File name prefix**: Leave empty
   - **Duration**: Leave default
3. Click **"Create New Key"**
4. **IMPORTANT**: Copy these immediately (shown only once):
   - **keyID**: `004xxxxxxxxxxxx000000001` (this is your Access Key ID)
   - **applicationKey**: `K004xxxxxxxxxxxxxxxxxxxxxxxxxxx` (this is your Secret Key)

### Get S3-Compatible Credentials

B2 is S3-compatible. Your credentials:
```
B2_KEY_ID=004xxxxxxxxxxxx000000001
B2_APP_KEY=K004xxxxxxxxxxxxxxxxxxxxxxxxxxx
B2_BUCKET=contenthosting-media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
```

Find your endpoint/region in Bucket details → "Endpoint" field.

---

## Step 3: Set Up Workers KV Namespace

1. In Cloudflare Dashboard, go to **Workers & Pages** → **KV**
2. Click **"Create a namespace"**
3. Name it: `CONTENT_METADATA`
4. Note the **Namespace ID** (you'll need this for wrangler.toml)

---

## Step 4: Create Cloudflare Pages Project

### Option A: GitHub Integration (Recommended)

1. Push this repo to GitHub
2. In Cloudflare Dashboard → **Workers & Pages** → **Create**
3. Select **"Pages"** → **"Connect to Git"**
4. Select your GitHub repo
5. Configure build:
   - **Build command**: (leave empty)
   - **Build output directory**: `public`
   - **Root directory**: `/`
6. Click **"Save and Deploy"**

### Option B: Direct Upload with Wrangler

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy (from project root)
wrangler pages deploy public --project-name=contenthosting
```

---

## Step 5: Configure Environment Variables

### In Cloudflare Dashboard:

1. Go to your Pages project → **Settings** → **Environment variables**
2. Add these variables for **Production** (and Preview if needed):

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_PASSWORD_HASH` | `$2a$10$...` | See "How to Hash Password" below |
| `B2_KEY_ID` | `004xxxxxxxxxxxx000000001` | From B2 App Key |
| `B2_APP_KEY` | `K004xxxxxxxxxxxxx` | From B2 App Key |
| `B2_BUCKET` | `contenthosting-media` | Your bucket name |
| `B2_ENDPOINT` | `s3.us-west-004.backblazeb2.com` | Your B2 endpoint |
| `B2_REGION` | `us-west-004` | Your B2 region |

### For Local Development (.dev.vars):

Create `.dev.vars` file in project root (never commit this!):

```env
ADMIN_PASSWORD_HASH=your_bcrypt_hash_here
B2_KEY_ID=004xxxxxxxxxxxx000000001
B2_APP_KEY=K004xxxxxxxxxxxxxxxxxxxxxxxxxxx
B2_BUCKET=contenthosting-media
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
```

---

## Step 6: Configure KV Binding

1. Go to Pages project → **Settings** → **Functions**
2. Scroll to **KV namespace bindings**
3. Add binding:
   - **Variable name**: `CONTENT_KV`
   - **KV namespace**: Select `CONTENT_METADATA`
4. Save

Or add to `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "CONTENT_KV"
id = "your-namespace-id-here"
```

---

## Step 7: DNS Setup for Media Subdomain

**CRITICAL**: Set media subdomain to **DNS-only (grey cloud)** to avoid Cloudflare ToS issues with video streaming.

1. Go to Cloudflare Dashboard → DNS
2. Add record:
   - **Type**: CNAME
   - **Name**: `media`
   - **Target**: `f004.backblazeb2.com` (your B2 friendly URL hostname)
   - **Proxy status**: **DNS only** (click to turn OFF orange cloud → grey cloud)
3. Save

Alternative (if using B2 S3 endpoint):
   - **Type**: CNAME
   - **Name**: `media`
   - **Target**: `s3.us-west-004.backblazeb2.com`
   - **Proxy status**: **DNS only**

---

## Step 8: Set Custom Domain

1. Go to Pages project → **Custom domains**
2. Add: `contenthosting.org`
3. Cloudflare will automatically configure DNS
4. Wait for SSL certificate (usually instant)

---

## How to Hash Your Admin Password

### Option 1: Using Node.js (recommended)

```javascript
// hash-password.js
const crypto = require('crypto');

const password = 'your-secure-password-here';
const hash = crypto.createHash('sha256').update(password).digest('hex');
console.log('SHA-256 Hash:', hash);
// Use this hash as ADMIN_PASSWORD_HASH
```

Run: `node hash-password.js`

### Option 2: Online (less secure, use only for testing)

Use a SHA-256 generator online, but **never** use your real password on third-party sites.

### Option 3: Using Terminal

```bash
echo -n "your-secure-password-here" | sha256sum
```

---

## How to Deploy

### Initial Deployment

```bash
# Clone the repo
git clone https://github.com/your-username/contenthosting.org.git
cd contenthosting.org

# Install dependencies
npm install

# Login to Cloudflare
npx wrangler login

# Deploy to Pages
npx wrangler pages deploy public --project-name=contenthosting
```

### Subsequent Deployments

```bash
# After making changes
npx wrangler pages deploy public --project-name=contenthosting

# Or if using GitHub integration, just push:
git add .
git commit -m "Update"
git push
```

---

## Local Development

```bash
# Start local dev server with Pages Functions
npx wrangler pages dev public

# This will:
# - Serve static files from /public
# - Run Pages Functions from /functions
# - Use .dev.vars for environment variables
# - Simulate KV bindings
```

Open: http://localhost:8788/admin

---

## Test the Full Flow

1. **Open Admin**: https://contenthosting.org/admin
2. **Login**: Enter your password
3. **Upload**: Select a video or image file
4. **Wait**: File uploads directly to B2
5. **Copy Embed**: Click "Copy Embed Code" button
6. **Test**: Paste iframe into test HTML file
7. **Verify**: Video plays with Plyr.io, image displays

### Test HTML File

```html
<!DOCTYPE html>
<html>
<head><title>Embed Test</title></head>
<body>
  <h1>Testing Embed</h1>
  
  <!-- Paste your copied embed code here -->
  <iframe 
    src="https://contenthosting.org/embed/abc123" 
    width="100%" 
    height="450" 
    frameborder="0" 
    allowfullscreen>
  </iframe>
  
</body>
</html>
```

---

## Troubleshooting

### "Upload failed" error
- Check B2 credentials are correct
- Verify bucket exists and is private
- Check browser console for detailed error

### "Access denied" on embed
- Signed URL may have expired (30 min default)
- Refresh the embed page to get new signed URL

### CORS errors
- B2 bucket needs CORS configuration (see below)
- Make sure media subdomain DNS is set up

### Configure B2 CORS

In Backblaze B2, go to Bucket Settings → CORS Rules:

```json
[
  {
    "corsRuleName": "allowAll",
    "allowedOrigins": ["*"],
    "allowedHeaders": ["*"],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "exposeHeaders": ["ETag"],
    "maxAgeSeconds": 3600
  }
]
```

---

## Security Checklist

- [ ] Admin password is strong (16+ characters)
- [ ] Password hash is stored in env, not code
- [ ] B2 bucket is set to Private
- [ ] Media subdomain is DNS-only (grey cloud)
- [ ] .dev.vars is in .gitignore
- [ ] Signed URLs expire in 30-60 minutes
