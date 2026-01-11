# ContentHosting.org

A minimal, private video and image embed generator using Cloudflare Pages + Backblaze B2.

## Quick Start

1. **Clone and install:**
   ```bash
   git clone https://github.com/your-username/contenthosting.org.git
   cd contenthosting.org
   npm install
   ```

2. **Set up credentials (see [SETUP.md](SETUP.md)):**
   - Create Backblaze B2 bucket
   - Create Workers KV namespace
   - Configure environment variables

3. **Local development:**
   ```bash
   # Copy example env file
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your credentials
   
   # Start dev server
   npm run dev
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) - System overview and diagrams
- [SETUP.md](SETUP.md) - Detailed setup instructions

## Features

- ✅ Password-protected admin panel
- ✅ Direct browser-to-B2 uploads (bypasses Worker limits)
- ✅ Plyr.io video player
- ✅ Signed URLs for security
- ✅ Copy-to-clipboard embed codes
- ✅ Zero external servers (Cloudflare + B2 only)

## Usage

1. Go to `https://contenthosting.org/admin`
2. Login with your password
3. Upload video or image
4. Click "Embed" to copy iframe code
5. Paste into your website

## Embed Example

```html
<iframe 
  src="https://contenthosting.org/embed/abc123xyz" 
  width="100%" 
  height="450" 
  frameborder="0" 
  allowfullscreen>
</iframe>
```

## Security

- Admin access via SHA-256 password hash
- Files served via time-limited signed URLs
- Media subdomain uses DNS-only (grey cloud) for ToS compliance
- Session tokens expire after 24 hours

## Cost (Free Tier)

| Service | Free Allowance |
|---------|----------------|
| Cloudflare Pages | Unlimited static, 100k functions/day |
| Workers KV | 100k reads, 1k writes/day |
| Backblaze B2 | 10GB storage, 1GB egress/day |

**Typical monthly cost: $0** for light usage

## License

Private use only.