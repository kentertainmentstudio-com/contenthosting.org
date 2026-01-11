# ContentHosting.org - Self-hosted Video & Image Embed Generator

## Project Overview

A minimal, private video and image hosting/embed tool designed for personal use.
Upload media files → Get embed code → Paste into your main website.

### Purpose
- Upload videos/images via admin panel
- Generate embeddable iframes with Plyr.io video player
- Embed content on xpandorax.com (or any site) without storing files there

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR WORKFLOW                                   │
│                                                                              │
│   1. Upload          2. Get Embed Code       3. Paste in Sanity CMS         │
│      ↓                    ↓                       ↓                          │
│   /admin  ──────────→  Copy iframe  ──────────→  xpandorax.com              │
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
│  │   └──────┬──────┘    └──────┬──────┘    │  /api/upload-url.js     │  │   │
│  │          │                  │           │  /api/register.js       │  │   │
│  │          │                  │           │  /api/list.js           │  │   │
│  │          ▼                  ▼           │  /api/sign-url.js       │  │   │
│  │   ┌──────────────────────────────────┐  └───────────┬─────────────┘  │   │
│  │   │      Workers KV (Metadata)       │◄─────────────┘               │   │
│  │   │   fileId → {filename, type,      │                               │   │
│  │   │            size, b2Key, date}    │                               │   │
│  │   └──────────────────────────────────┘                               │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    │ Presigned URLs                          │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     BACKBLAZE B2 STORAGE                              │   │
│  │                                                                       │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │              contenthosting-media bucket                     │    │   │
│  │   │                                                              │    │   │
│  │   │   videos/abc123.mp4   images/def456.jpg   images/ghi789.png │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                              │                                        │   │
│  │                              │ Signed GET URLs (30-60 min expiry)     │   │
│  │                              ▼                                        │   │
│  │   ┌─────────────────────────────────────────────────────────────┐    │   │
│  │   │     media.contenthosting.org (CNAME, DNS-only/grey cloud)   │    │   │
│  │   │         → Direct B2 delivery, Bandwidth Alliance            │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             DATA FLOW                                        │
│                                                                              │
│  UPLOAD FLOW:                                                                │
│  ────────────                                                                │
│  1. Browser → /api/upload-url → Get presigned POST URL                      │
│  2. Browser → Backblaze B2 → Direct upload (bypasses Worker limits)         │
│  3. Browser → /api/register → Save metadata to KV                           │
│                                                                              │
│  EMBED FLOW:                                                                 │
│  ──────────                                                                  │
│  1. Visitor → /embed/{id} → Fetch metadata from KV                          │
│  2. Server → /api/sign-url → Generate signed B2 URL                         │
│  3. Browser → media.contenthosting.org → Stream video/image                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Static Hosting | Cloudflare Pages | Serve HTML/CSS/JS |
| API Functions | Pages Functions | Handle uploads, signing, metadata |
| Metadata Store | Workers KV | Store file info (no database) |
| File Storage | Backblaze B2 | Store actual video/image files |
| Video Player | Plyr.io | Beautiful, accessible video player |
| Media Delivery | B2 + Signed URLs | Secure, cost-effective delivery |

---

## Security Model

1. **Admin Access**: Password-protected `/admin` page (hash stored in env)
2. **File Access**: Time-limited signed URLs (30-60 min expiry)
3. **Direct Upload**: Browser → B2 (no proxy through Worker)
4. **ToS Compliance**: Media subdomain is DNS-only (grey cloud)

---

## URL Structure

| URL | Purpose |
|-----|---------|
| `contenthosting.org` | Landing/redirect |
| `contenthosting.org/admin` | Upload & manage files |
| `contenthosting.org/embed/{id}` | Embeddable player page |
| `contenthosting.org/api/*` | API endpoints |
| `media.contenthosting.org` | Media delivery (DNS-only) |

---

## File ID Format

Files are identified by a short unique ID (e.g., `abc123xyz`).
Generated using: `crypto.randomUUID().slice(0, 12)`

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
