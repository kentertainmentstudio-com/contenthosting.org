# ContentHosting.org - Self-hosted Video & Image Embed Generator

## Project Overview

A minimal, private video and image hosting/embed tool designed for personal use.
Upload media files → Get embed code → Paste into your main website.

### Key Features
- ✅ **Password-protected admin panel** at `/admin`
- ✅ **TailAdmin dashboard** with responsive file manager
- ✅ **Direct browser-to-B2 uploads** (bypasses Cloudflare's 100MB Worker limit)
- ✅ **Cloudflare D1 database** for file metadata storage
- ✅ **Permanent embed URLs** at `https://contenthosting.org/embed/{fileId}`
- ✅ **Plyr.io video player** with beautiful controls and fullscreen support
- ✅ **One-click copy** for embed URL and iframe code
- ✅ **File management** with search, thumbnails, and delete functionality
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
│  │   │ TailAdmin   │    │ (Plyr.io)   │    │                         │  │   │
│  │   │  Dashboard  │    │  Player     │    │  /api/auth.js           │  │   │
│  │   └──────┬──────┘    └──────┬──────┘    │  /api/presigned-post.js │  │   │
│  │          │                  │           │  /api/register-upload.js│  │   │
│  │          │                  │           │  /api/list-files.js     │  │   │
│  │          ▼                  ▼           │  /api/delete-file.js    │  │   │
│  │   ┌──────────────────────────────────┐  │  /api/get-embed-url.js  │  │   │
│  │   │     Cloudflare D1 (SQLite)       │◄─┴─────────────────────────┘  │   │
│  │   │                                  │                               │   │
│  │   │   Table: files                   │                               │   │
│  │   │   - id (PRIMARY KEY)             │                               │   │
│  │   │   - filename                     │                               │   │
│  │   │   - type                         │                               │   │
│  │   │   - size                         │                               │   │
│  │   │   - upload_date                  │                               │   │
│  │   │   - b2_key                       │                               │   │
│  │   │   - thumbnail_url                │                               │   │
│  │   │   - description                  │                               │   │
│  │   └──────────────────────────────────┘                               │   │
│  │                                                                       │   │
│  │   ┌──────────────────────────────────┐                               │   │
│  │   │     Workers KV (Sessions Only)   │                               │   │
│  │   │   session:{token} → valid        │                               │   │
│  │   └──────────────────────────────────┘                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ Presigned PUT (upload) / Direct GET     │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BACKBLAZE B2 STORAGE                              │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │              contenthosting-media bucket (PUBLIC)            │    │   │
│  │   │                                                              │    │   │
│  │   │   videos/abc123.mp4   images/def456.jpg   images/ghi789.png │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │     media.contenthosting.org                                 │    │   │
│  │   │     CNAME → f004.backblazeb2.com (DNS-only/grey cloud)      │    │   │
│  │   │     → Bandwidth Alliance: Cloudflare ↔ B2 = FREE egress     │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA FLOW                                        │
│                                                                              │
│  UPLOAD FLOW (Browser → B2 directly):                                       │
│  ─────────────────────────────────────                                      │
│  1. Browser → POST /api/presigned-post → Get presigned PUT URL              │
│  2. Browser → PUT directly to B2 → Upload file (up to 500MB+)               │
│  3. Browser → POST /api/register-upload → Save metadata to D1               │
│                                                                              │
│  EMBED FLOW (Permanent URLs):                                               │
│  ────────────────────────────                                               │
│  1. Visitor → GET /embed/{fileId}                                           │
│  2. Server → Query D1 for metadata                                          │
│  3. Server → Return HTML with Plyr.io player + public B2 URL                │
│  4. Browser → Stream video/image from media.contenthosting.org              │
│                                                                              │
│  FILE LIST FLOW:                                                            │
│  ────────────────                                                           │
│  1. Admin → GET /api/list-files                                             │
│  2. Server → Query D1 with optional search                                  │
│  3. Return JSON array of files with thumbnails                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Cloudflare D1)

```sql
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    type TEXT NOT NULL,
    size INTEGER NOT NULL,
    upload_date TEXT NOT NULL,
    b2_key TEXT NOT NULL,
    thumbnail_url TEXT,
    description TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_upload_date ON files(upload_date DESC);
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
```

---

## Folder Structure

```
contenthosting.org/
├── public/
│   ├── index.html              → Redirect to /admin
│   ├── admin.html              → TailAdmin file manager + upload
│   └── embed-template.html     → Plyr player template (reference)
├── functions/
│   ├── api/
│   │   ├── _auth-middleware.js → Auth verification helper
│   │   ├── _s3-signer.js       → S3 presigned URL generator
│   │   ├── auth.js             → POST /api/auth (login)
│   │   ├── presigned-post.js   → POST /api/presigned-post
│   │   ├── register-upload.js  → POST /api/register-upload
│   │   ├── list-files.js       → GET /api/list-files
│   │   ├── delete-file.js      → DELETE /api/delete-file
│   │   └── get-embed-url.js    → GET /api/get-embed-url
│   └── embed/
│       └── [id].js             → GET /embed/{id} (dynamic)
├── scripts/
│   └── hash-password.js        → Password hash utility
├── schema.sql                  → D1 database schema
├── .dev.vars                   → Local secrets (gitignored)
├── wrangler.toml               → D1 + env bindings
├── package.json
├── ARCHITECTURE.md             → This file
├── SETUP.md                    → Setup instructions
└── README.md
```

---

## API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/auth` | Login, returns session token | No |
| POST | `/api/presigned-post` | Generate B2 upload URL | Yes |
| POST | `/api/register-upload` | Save file metadata to D1 | Yes |
| GET | `/api/list-files` | List all files from D1 | Yes |
| DELETE | `/api/delete-file` | Delete file from B2 + D1 | Yes |
| GET | `/api/get-embed-url/{id}` | Get embed info for file | No |
| GET | `/embed/{id}` | Serve embed page | No |

---

## Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Static Hosting | Cloudflare Pages | Serve HTML/CSS/JS |
| API Functions | Pages Functions (Workers) | Handle auth, uploads, metadata |
| Metadata Store | Cloudflare D1 (SQLite) | Store file metadata |
| Session Store | Workers KV | Store session tokens |
| File Storage | Backblaze B2 (S3-compatible) | Store actual video/image files |
| Video Player | Plyr.io | Modern, accessible video player |
| UI Framework | TailAdmin (Tailwind CSS) | Admin dashboard |
| Media Delivery | B2 + CNAME | Cost-effective with Bandwidth Alliance |

---

## Security Model

1. **Admin Access**: Password-protected `/admin` page (SHA-256 hash stored in env)
2. **Session Tokens**: Random tokens stored in KV with 24-hour TTL
3. **Public Bucket**: Files are publicly accessible via media subdomain
4. **Direct Upload**: Browser → B2 (bypasses Worker, no body size limit)
5. **ToS Compliance**: Media subdomain is DNS-only (grey cloud) for video streaming

---

## D1 Data Structure

```sql
-- Files table
SELECT * FROM files;
+──────────────+──────────────────+───────────+──────────+─────────────────────────+────────────────────────────+───────────────+─────────────+
| id           | filename         | type      | size     | upload_date             | b2_key                     | thumbnail_url | description |
+──────────────+──────────────────+───────────+──────────+─────────────────────────+────────────────────────────+───────────────+─────────────+
| abc123xyz456 | my-video.mp4     | video/mp4 | 52428800 | 2026-01-12T10:30:00.000Z| videos/abc123xyz456.mp4    | NULL          | NULL        |
| def789ghi012 | photo.jpg        | image/jpeg| 1048576  | 2026-01-12T11:00:00.000Z| images/def789ghi012.jpg    | NULL          | NULL        |
+──────────────+──────────────────+───────────+──────────+─────────────────────────+────────────────────────────+───────────────+─────────────+
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
| Cloudflare D1 | 5GB storage, 5M reads/day | $0 |
| Workers KV | 100k reads, 1k writes/day | $0 |
| Backblaze B2 | 10GB storage, 1GB/day egress | $0 |
| Beyond free tier | ~$0.005/GB storage + $0.01/GB egress | $1-5/month |

**Total for light use: $0/month** (within free tiers)
**Total for medium use: $1-10/month**
