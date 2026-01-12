# ContentHosting.org - Complete Setup Guide

This guide walks you through setting up your self-hosted video/image embed system with Cloudflare D1 database.

---

## Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- [Cloudflare account](https://cloudflare.com/) with domain connected
- [Backblaze B2 account](https://www.backblaze.com/b2/cloud-storage.html) (free tier: 10GB)
- Git for version control
- Wrangler CLI: `npm install -g wrangler`

---

## Step 1: Backblaze B2 Setup

### 1.1 Create a B2 Bucket

1. Log in to [Backblaze B2](https://secure.backblaze.com/b2_buckets.htm)
2. Click **"Create a Bucket"**
3. Configure:
   - **Bucket Name**: `contenthosting-media` (must be globally unique)
   - **Files in Bucket are**: **Public** ✅ (Required for permanent embed URLs)
   - **Default Encryption**: None
   - **Object Lock**: Disabled
4. Click **"Create a Bucket"**

### 1.2 Note Your Bucket Info

After creating the bucket, note these values:
- **Bucket Name**: `contenthosting-media`
- **Endpoint**: e.g., `s3.us-west-004.backblazeb2.com`
- **Region**: e.g., `us-west-004`
- **Public URL**: `https://f004.backblazeb2.com/file/contenthosting-media`

### 1.3 Create Application Key

1. Go to **App Keys** in B2 sidebar
2. Click **"Add a New Application Key"**
3. Configure:
   - **Name**: `contenthosting-api`
   - **Allow access to Bucket(s)**: Select your bucket
   - **Type of Access**: Read and Write
   - **Allow List All Bucket Names**: Yes
4. Click **"Create New Key"**
5. **IMPORTANT**: Copy and save immediately:
   - **keyID**: e.g., `004abc123def456...`
   - **applicationKey**: e.g., `K004xyz789...` (shown only once!)

### 1.4 CORS Configuration (Required for Browser Uploads)

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
      "s3_head",
      "s3_delete"
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

## Step 2: Cloudflare D1 Database Setup

### 2.1 Create D1 Database

```bash
# Login to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create contenthosting-db
```

Copy the `database_id` from the output. It will look like:
```
✅ Successfully created DB 'contenthosting-db'
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2.2 Update wrangler.toml

Edit `wrangler.toml` and replace `YOUR_D1_DATABASE_ID_HERE` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "contenthosting-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### 2.3 Initialize Database Schema

```bash
# Run the schema to create the files table
wrangler d1 execute contenthosting-db --file=schema.sql
```

Verify the table was created:
```bash
wrangler d1 execute contenthosting-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

---

## Step 3: Cloudflare KV Setup (Sessions)

### 3.1 Create KV Namespace

```bash
wrangler kv:namespace create CONTENT_KV
```

Copy the namespace ID from the output.

### 3.2 Update wrangler.toml

Replace `local-kv` with your actual KV namespace ID:

```toml
[[kv_namespaces]]
binding = "CONTENT_KV"
id = "your-kv-namespace-id"
preview_id = "your-kv-namespace-id"
```

---

## Step 4: Media Subdomain Setup (Optional but Recommended)

For bandwidth efficiency (Cloudflare Bandwidth Alliance = FREE egress from B2):

### 4.1 Add DNS Record

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

### 4.2 Update B2_PUBLIC_URL (Optional)

If using the media subdomain, update `wrangler.toml`:

```toml
[vars]
B2_PUBLIC_URL = "https://media.contenthosting.org/file/contenthosting-media"
```

---

## Step 5: Environment Variables

### 5.1 Create Local Development File

Create `.dev.vars` in the project root (this file is gitignored):

```bash
# .dev.vars - Local development secrets

# Backblaze B2 Credentials
B2_KEY_ID=004abc123def456789
B2_APP_KEY=K004xyz789yourSecretKeyHere
B2_BUCKET=contenthosting-media
B2_REGION=us-west-004
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/contenthosting-media

# Admin Password Hash (see Step 5.2)
ADMIN_PASSWORD_HASH=your_sha256_hash_here
```

### 5.2 Generate Admin Password Hash

```bash
npm run hash-password
```

Enter your desired password when prompted. Copy the SHA-256 hash and paste it into:
1. `.dev.vars` for local development
2. Cloudflare Dashboard for production (see Step 6)

**Alternative (manual):**
```bash
node -e "console.log(require('crypto').createHash('sha256').update('YourPasswordHere').digest('hex'))"
```

---

## Step 6: Production Secrets

### 6.1 Set Secrets in Cloudflare Dashboard

1. Go to Cloudflare Dashboard → **Workers & Pages**
2. Select your **contenthosting** project
3. Go to **Settings** → **Environment variables**
4. Add production secrets (these override .dev.vars):

| Variable Name | Value |
|---------------|-------|
| `ADMIN_PASSWORD_HASH` | Your SHA-256 password hash |
| `B2_KEY_ID` | Your Backblaze key ID |
| `B2_APP_KEY` | Your Backblaze application key |

### 6.2 Alternative: Use Wrangler CLI

```bash
wrangler secret put ADMIN_PASSWORD_HASH
wrangler secret put B2_KEY_ID
wrangler secret put B2_APP_KEY
```

---

## Step 7: Local Development

### 7.1 Install Dependencies

```bash
npm install
```

### 7.2 Start Development Server

```bash
npm run dev
```

This starts the development server at `http://localhost:8788`

### 7.3 Test the Flow

1. Open `http://localhost:8788/admin`
2. Log in with your password
3. Upload a file
4. Copy the embed URL
5. Test the embed at `http://localhost:8788/embed/{fileId}`

---

## Step 8: Deploy to Production

### 8.1 Deploy

```bash
npm run deploy
```

Or manually:
```bash
wrangler pages deploy public --project-name=contenthosting
```

### 8.2 Verify Production

1. Visit `https://contenthosting.org/admin`
2. Log in with your password
3. Upload a file
4. Test the embed URL

---

## Folder Structure

```
contenthosting.org/
├── public/
│   ├── index.html              → Redirect to /admin
│   ├── admin.html              → TailAdmin file manager + upload
│   └── embed-template.html     → Reference template
├── functions/
│   ├── api/
│   │   ├── _auth-middleware.js → Auth verification
│   │   ├── _s3-signer.js       → AWS Sig V4 for B2
│   │   ├── auth.js             → POST /api/auth
│   │   ├── presigned-post.js   → POST /api/presigned-post
│   │   ├── register-upload.js  → POST /api/register-upload
│   │   ├── list-files.js       → GET /api/list-files
│   │   ├── delete-file.js      → DELETE /api/delete-file
│   │   └── get-embed-url.js    → GET /api/get-embed-url
│   └── embed/
│       └── [id].js             → GET /embed/{id}
├── scripts/
│   └── hash-password.js        → Password hash utility
├── schema.sql                  → D1 database schema
├── .dev.vars                   → Local secrets (gitignored)
├── wrangler.toml               → Cloudflare config
└── package.json
```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth` | Login with password | No |
| POST | `/api/presigned-post` | Get B2 upload URL | Yes |
| POST | `/api/register-upload` | Save file to D1 | Yes |
| GET | `/api/list-files` | List files from D1 | Yes |
| DELETE | `/api/delete-file?id={id}` | Delete file | Yes |
| GET | `/api/get-embed-url?id={id}` | Get embed info | No |
| GET | `/embed/{id}` | Embed page | No |

---

## Testing the Full Flow

### Upload Flow
1. Go to `/admin` and log in
2. Drag & drop or select a file
3. Click Upload
4. File uploads directly to B2 (progress shown)
5. Metadata saved to D1
6. Copy embed URL or code

### Embed Flow
1. Open embed URL: `https://contenthosting.org/embed/{fileId}`
2. Video: Plyr.io player with controls
3. Image: Responsive centered image
4. Embed in iframe on any website

### Delete Flow
1. Click delete button in file list
2. Confirm deletion
3. File removed from B2 and D1

---

## Security Notes

1. **Password Security**: Use a strong password. The SHA-256 hash is stored in environment variables.

2. **Public B2 Bucket**: All uploaded files are publicly accessible. Do not upload sensitive content.

3. **Session Tokens**: Stored in KV with 24-hour expiry. Users must re-login after expiry.

4. **CORS**: Only configured origins can upload directly to B2.

5. **Grey Cloud DNS**: Media subdomain uses DNS-only mode to comply with Cloudflare ToS for video streaming.

---

## Troubleshooting

### "Failed to get upload URL"
- Check B2 credentials in `.dev.vars` or production secrets
- Verify B2 bucket exists and is public

### "CORS error" on upload
- Update B2 CORS rules to include your domain
- For local dev, add `http://localhost:8788` to allowed origins

### "File not found" on embed
- Verify file was registered in D1
- Check D1 database: `wrangler d1 execute contenthosting-db --command="SELECT * FROM files;"`

### D1 errors
- Make sure schema was applied: `wrangler d1 execute contenthosting-db --file=schema.sql`
- Check database binding in `wrangler.toml`

---

## Cost Estimate

| Service | Free Tier | Beyond Free |
|---------|-----------|-------------|
| Cloudflare Pages | Unlimited static | - |
| Pages Functions | 100k requests/day | $0.15/million |
| Cloudflare D1 | 5GB, 5M reads/day | $0.75/million reads |
| Workers KV | 100k reads/day | $0.50/million reads |
| Backblaze B2 | 10GB storage | $0.005/GB/month |
| B2 Egress | 1GB/day free | FREE via Bandwidth Alliance |

**Typical monthly cost for personal use: $0**
