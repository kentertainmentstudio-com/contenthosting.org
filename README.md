# ContentHosting.org

Self-hosted video and image embed generator using Cloudflare Pages + D1 + Backblaze B2.

Upload media files → Get permanent embed URLs → Paste anywhere.

## ✨ Features

- 🔐 **Password-protected admin panel** at `/admin`
- 🎨 **TailAdmin dashboard** with responsive file manager
- 📤 **Direct uploads to B2** (bypasses Cloudflare's 100MB limit)
- 🗄️ **Cloudflare D1 database** for file metadata
- 🎬 **Plyr.io video player** with modern controls
- 🔗 **Permanent embed URLs** that don't expire
- 📋 **One-click copy** for embed URL and iframe code
- 🔍 **Search and filter** files by name
- 🗑️ **File management** with delete functionality
- 🆓 **Zero cost** with Cloudflare + B2 free tiers

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-username/contenthosting.org.git
cd contenthosting.org
npm install
```

### 2. Set Up D1 Database

```bash
# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create contenthosting-db

# Update wrangler.toml with your database_id

# Initialize schema
npm run db:init
```

### 3. Set Up Services

- Create a [Backblaze B2](https://www.backblaze.com/b2/) public bucket
- Create a [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) namespace
- See [SETUP.md](SETUP.md) for detailed instructions

### 4. Configure Environment

```bash
# Create .dev.vars with your credentials
cat > .dev.vars << EOF
B2_KEY_ID=your_key_id
B2_APP_KEY=your_app_key
B2_BUCKET=contenthosting-media
B2_REGION=us-west-004
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/contenthosting-media
ADMIN_PASSWORD_HASH=your_sha256_hash
EOF

# Generate password hash
npm run hash-password
```

### 5. Run Locally

```bash
npm run dev
# Open http://localhost:8788/admin
```

### 6. Deploy

```bash
npm run deploy
# Or push to GitHub if connected to Cloudflare Pages
```

## 📖 Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, diagrams, data flow |
| [SETUP.md](SETUP.md) | Step-by-step setup instructions |

## 🎯 Usage

1. Visit `https://contenthosting.org/admin`
2. Login with your password
3. Upload video (MP4, WebM) or image (JPG, PNG, GIF)
4. Copy the embed URL or iframe code
5. Paste into your website

## 📺 Embed Example

```html
<iframe 
  src="https://contenthosting.org/embed/abc123xyz" 
  width="100%" 
  height="450" 
  frameborder="0" 
  allowfullscreen>
</iframe>
```

## 🏗️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | TailAdmin (Tailwind CSS) + Vanilla JS |
| Backend | Cloudflare Pages Functions |
| Database | Cloudflare D1 (SQLite) |
| Sessions | Cloudflare Workers KV |
| Storage | Backblaze B2 (S3-compatible) |
| Video Player | Plyr.io |

## 🔒 Security

| Feature | Implementation |
|---------|----------------|
| Admin auth | SHA-256 password hash |
| Sessions | Random tokens with 24h TTL in KV |
| File access | Public B2 bucket for permanent embeds |
| Media delivery | DNS-only mode for ToS compliance |

## 💰 Cost (Free Tiers)

| Service | Free Allowance |
|---------|----------------|
| Cloudflare Pages | Unlimited static, 100k functions/day |
| Cloudflare D1 | 5GB storage, 5M reads/day |
| Workers KV | 100k reads, 1k writes/day |
| Backblaze B2 | 10GB storage |
| B2 Egress | FREE via Bandwidth Alliance |

## 📁 Project Structure

```
contenthosting.org/
├── public/
│   ├── admin.html          # TailAdmin file manager
│   └── index.html          # Redirect to /admin
├── functions/
│   ├── api/                # API endpoints
│   └── embed/[id].js       # Dynamic embed pages
├── schema.sql              # D1 database schema
├── wrangler.toml           # Cloudflare config
└── package.json
```

## 📜 License

MIT License - Feel free to use and modify for your own projects.
