# ContentHosting.org - Self-hosted Video & Image Embed Generator

## Project Overview

A minimal, private video and image hosting/embed tool designed for personal use.
Upload media files → Get embed code → Paste into your main website.

### Key Features
- ✅ **Password-protected admin panel** at `/admin`
- ✅ **Direct browser-to-B2 uploads** (bypasses Cloudflare's 100MB Worker limit)
- ✅ **Permanent embed URLs** at `https://contenthosting.org/embed/{fileId}`
- ✅ **Plyr.io video player** with beautiful controls and fullscreen support
- ✅ **One-click copy** for embed URL and iframe code
- ✅ **File management** with list view and delete functionality
- ✅ **Supported formats**: MP4, WebM, JPG, PNG, GIF

### Purpose
- Upload videos/images via admin panel
- Generate embeddable iframes with Plyr.io video player
- Embed content on any website without storing files there

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR WORKFLOW                                   │
│                                                                              │
│   1. Go to /admin        2. Upload file        3. Copy embed code           │
│      ↓                       ↓                      ↓                        │
│   Enter password ──→ Select video/image ──→ Paste in your website           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    CLOUDFLARE PAGES                                   │   │
│  │                  contenthosting.org                                   │   │
│  │                                                                       │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │   │
│  │   │   /admin    │    │ /embed/{id} │    │   Pages Functions       │  │   │
│  │   │  (Upload UI)│    │ (Plyr.io)   │    │                         │  │   │
│  │   └──────┬──────┘    └──────┬──────┘    │  /api/auth.js           │  │   │
│  │          │                  │           │  /api/upload-url.js     │  │   │
│  │          │                  │           │  /api/register.js       │  │   │
│  │          ▼                  ▼           │  /api/list.js           │  │   │
│  │   ┌──────────────────────────────────┐  │  /api/delete.js         │  │   │
│  │   │      Workers KV (Metadata)       │◄─┴─────────────────────────┘  │   │
│  │   │   file:{id} → {metadata}         │                               │   │
│  │   │   session:{token} → valid        │                               │   │
│  │   │   file_index → [id1, id2, ...]   │                               │   │
│  │   └──────────────────────────────────┘                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ Presigned PUT (upload) / GET (embed)    │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BACKBLAZE B2 STORAGE                              │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │              contenthosting-media bucket                     │    │   │
│  │   │                                                              │    │   │
│  │   │   videos/abc123.mp4   images/def456.jpg   images/ghi789.png │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │   Option A: Private bucket + Signed URLs (more secure)               │   │
│  │   Option B: Public bucket + Direct URLs (simpler, recommended)       │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │     media.contenthosting.org (optional)                      │    │   │
│  │   │     CNAME → f004.backblazeb2.com (DNS-only/grey cloud)      │    │   │
│  │   │     → Bandwidth Alliance: Cloudflare ↔ B2 = FREE egress     │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA FLOW                                        │
│                                                                              │
│  UPLOAD FLOW (Browser → B2, bypasses Worker body limit):                    │
│  ─────────────────────────────────────────────────────────                  │
│  1. Browser → POST /api/upload-url → Get presigned PUT URL                  │
│  2. Browser → PUT directly to B2 → Upload file (up to 500MB+)               │
│  3. Browser → POST /api/register → Save metadata to Workers KV              │
│                                                                              │
│  EMBED FLOW (Permanent URLs, no expiration worries):                        │
│  ──────────────────────────────────────────────────────                     │
│  1. Visitor → GET /embed/{fileId}                                           │
│  2. Server → Read metadata from KV                                          │
│  3. Server → Generate signed URL (or use public URL)                        │
│  4. Server → Return HTML with Plyr.io player                                │
│  5. Browser → Stream video/image from B2                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Static Hosting | Cloudflare Pages | Serve HTML/CSS/JS |
| API Functions | Pages Functions (Workers) | Handle auth, uploads, metadata |
| Metadata Store | Workers KV | Store file info (no external DB) |
| File Storage | Backblaze B2 (S3-compatible) | Store actual video/image files |
| Video Player | Plyr.io | Modern, accessible video player |
| Media Delivery | B2 + optional CNAME | Cost-effective with Bandwidth Alliance |

---

## File Structure

```
contenthosting.org/
├── public/                     # Static files served by Cloudflare Pages
│   ├── index.html              # Redirect to /admin
│   ├── admin.html              # Upload form + file list + copy buttons
│   └── embed-template.html     # Template reference (not served directly)
├── functions/                  # Cloudflare Pages Functions (serverless)
│   ├── api/
│   │   ├── _auth-middleware.js # Shared auth verification
│   │   ├── _s3-signer.js       # AWS Sig V4 for B2 (presigned URLs)
│   │   ├── auth.js             # POST /api/auth (login)
│   │   ├── upload-url.js       # POST /api/upload-url (get presigned PUT)
│   │   ├── register.js         # POST /api/register (save metadata)
│   │   ├── list.js             # GET /api/list (get all files)
│   │   ├── delete.js           # POST /api/delete (remove file)
│   │   └── sign-url.js         # POST /api/sign-url (get signed GET URL)
│   └── embed/
│       └── [id].js             # Dynamic route: /embed/{fileId}
├── scripts/
│   └── hash-password.js        # Generate SHA-256 hash for admin password
├── .dev.vars                   # Local dev secrets (not committed)
├── .dev.vars.example           # Template for environment variables
├── wrangler.toml               # Cloudflare config
├── package.json
├── ARCHITECTURE.md             # This file
├── SETUP.md                    # Step-by-step setup guide
└── README.md                   # Quick start guide
```

---

## Security Model

1. **Admin Access**: Password-protected `/admin` page (SHA-256 hash stored in env)
2. **Session Tokens**: Random tokens stored in KV with 24-hour TTL
3. **File Access**: Time-limited signed URLs (configurable expiry)
4. **Direct Upload**: Browser → B2 (bypasses Worker, no body size limit)
5. **ToS Compliance**: Media subdomain is DNS-only (grey cloud) for video streaming

---

## URL Structure

| URL | Purpose |
|-----|---------|
| `contenthosting.org` | Redirect to /admin |
| `contenthosting.org/admin` | Upload & manage files |
| `contenthosting.org/embed/{id}` | Embeddable player page |
| `contenthosting.org/api/auth` | Login endpoint |
| `contenthosting.org/api/upload-url` | Get presigned PUT URL |
| `contenthosting.org/api/register` | Register file after upload |
| `contenthosting.org/api/list` | List all files |
| `contenthosting.org/api/delete` | Delete a file |
| `media.contenthosting.org` | Optional: Media delivery CNAME |

---

## KV Data Structure

```javascript
// Session tokens (auto-expire in 24h)
session:{token} → "valid"

// File metadata
file:{fileId} → {
  fileId: "abc123xyz456",
  filename: "my-video.mp4",
  contentType: "video/mp4",
  size: 52428800,
  b2Key: "videos/abc123xyz456.mp4",
  uploadDate: "2026-01-12T10:30:00.000Z"
}

// File index (for listing)
file_index → ["abc123xyz456", "def789ghi012", ...]
```

---

## File ID Format

Files are identified by a short unique ID (e.g., `abc123xyz456`).
Generated using: `crypto.randomUUID().replace(/-/g, '').slice(0, 12)`

---

## Monthly Cost Estimate (Low-Medium Usage)

| Service | Free Tier | Estimated Cost |
|---------|-----------|----------------|
| Cloudflare Pages | Unlimited static, 100k function invocations | $0 |
| Workers KV | 100k reads, 1k writes/day | $0 |
| Backblaze B2 | 10GB storage, 1GB/day egress | $0 |
| Beyond free tier | ~$0.005/GB storage + $0.01/GB egress | $1-5/month |

**Total for light use: $0/month** (within free tiers)
**Total for medium use: $1-10/month**
