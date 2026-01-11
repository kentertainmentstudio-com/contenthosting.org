# ContentHosting.org

Self-hosted video and image embed generator using Cloudflare Pages + Backblaze B2.

Upload media files → Get permanent embed URLs → Paste anywhere.

## ✨ Features

- 🔐 **Password-protected admin panel** at `/admin`
- 📤 **Direct uploads to B2** (bypasses Cloudflare's 100MB limit)
- 🎬 **Plyr.io video player** with modern controls
- 🔗 **Permanent embed URLs** that don't expire
- 📋 **One-click copy** for embed URL and iframe code
- 🗑️ **File management** with delete functionality
- 🆓 **Zero cost** with Cloudflare + B2 free tiers

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-username/contenthosting.org.git
cd contenthosting.org
npm install
```

### 2. Set Up Services

- Create a [Backblaze B2](https://www.backblaze.com/b2/) bucket
- Create a [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/) namespace
- See [SETUP.md](SETUP.md) for detailed instructions

### 3. Configure Environment

```bash
# Copy example env file
cp .dev.vars.example .dev.vars

# Generate password hash
npm run hash-password

# Edit .dev.vars with your credentials
```

### 4. Run Locally

```bash
npm run dev
# Open http://localhost:8788/admin
```

### 5. Deploy

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

## 🔒 Security

| Feature | Implementation |
|---------|----------------|
| Admin auth | SHA-256 password hash |
| Sessions | Random tokens with 24h TTL in KV |
| File access | Signed URLs (private) or direct (public) |
| Media delivery | DNS-only mode for ToS compliance |

## 💰 Cost (Free Tiers)

| Service | Free Allowance |
|---------|----------------|
| Cloudflare Pages | Unlimited static, 100k functions/day |
| Workers KV | 100k reads, 1k writes/day |
| Backblaze B2 | 10GB storage, 1GB egress/day |

**Typical monthly cost: $0** for light usage

## License

Private use only.