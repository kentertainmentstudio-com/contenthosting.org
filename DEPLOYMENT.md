# ContentHosting.org - Deployment & Secrets Setup Guide

## Status: ✅ Almost Ready!

### Completed Steps:
- ✅ D1 Database created: `f7c6fb7f-712c-4512-a7e6-1bbbd46a2b97`
- ✅ KV Namespace created: `aac68ce65b284507a14b5106317375c2`
- ✅ Database schema initialized with `files` table
- ✅ wrangler.toml configured
- ✅ Local development server running at `http://localhost:8788`
- ✅ Admin password hash generated: `14d761b854dd7d4883a3e60e92a322aefb53611e0c29f0de33f56351e3c84326`

---

## Next Steps: Set Production Secrets

### Step 1: Add B2 Credentials to Cloudflare

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Select your **contenthosting** project
3. Go to **Settings** → **Environment variables**
4. Add the following production secrets:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `B2_KEY_ID` | Your Backblaze Key ID (from SETUP.md Step 1.3) | Required |
| `B2_APP_KEY` | Your Backblaze Application Key (from SETUP.md Step 1.3) | Keep secret! |
| `ADMIN_PASSWORD_HASH` | `14d761b854dd7d4883a3e60e92a322aefb53611e0c29f0de33f56351e3c84326` | Admin login |

5. Click **Save**

### Step 2: Encrypt Secrets (Wrangler CLI)

Alternatively, use Wrangler CLI (recommended for security):

```bash
# Set B2 credentials
wrangler secret put B2_KEY_ID
# Paste your Backblaze key ID when prompted

wrangler secret put B2_APP_KEY
# Paste your Backblaze application key when prompted

wrangler secret put ADMIN_PASSWORD_HASH
# Paste: 14d761b854dd7d4883a3e60e92a322aefb53611e0c29f0de33f56351e3c84326
```

---

## Step 3: Test Locally

The local dev server is already running! Test it now:

```bash
# Local admin panel (use password: KenKen111902!)
http://localhost:8788/admin

# Try uploading a test file:
# - File will go to local B2 (using .dev.vars credentials)
# - Metadata saved to local D1
# - Embed URL: http://localhost:8788/embed/{fileId}
```

---

## Step 4: Deploy to Production

Once secrets are set in Cloudflare:

```bash
# Deploy Pages
npm run deploy

# Or manually:
wrangler pages deploy public --project-name=contenthosting
```

### Verify Production:

After deployment, test:
```
https://contenthosting.org/admin
# Login with password: KenKen111902!

https://contenthosting.org/embed/{fileId}
# Should show video/image player
```

---

## GitHub Push (Optional)

To fix the GitHub push issue, choose one option:

### Option A: Push to your personal repo
```bash
git remote set-url origin https://github.com/KenTheGreat19/contenthosting.org.git
git push origin main
```

### Option B: Set up SSH
```bash
# Generate SSH key if needed
ssh-keygen -t ed25519 -C "your-email@example.com"

# Add to GitHub (Settings → SSH Keys)
# Then use:
git remote set-url origin git@github.com:kentertainmentstudio-com/contenthosting.org.git
git push origin main
```

### Option C: Create personal access token
```bash
# Go to GitHub → Settings → Developer settings → Personal access tokens
# Create token with 'repo' scope
# Use as password when prompted:
git push origin main
```

---

## File Structure Reference

```
contenthosting.org/
├── public/
│   ├── admin.html              ✅ TailAdmin file manager
│   ├── index.html              ✅ Redirect to /admin
│   └── embed-template.html     ✅ Reference
├── functions/
│   ├── api/
│   │   ├── _auth-middleware.js ✅ Auth verification
│   │   ├── _s3-signer.js       ✅ AWS Sig V4
│   │   ├── auth.js             ✅ Login endpoint
│   │   ├── presigned-post.js   ✅ Upload URL generator
│   │   ├── register-upload.js  ✅ Save to D1
│   │   ├── list-files.js       ✅ Query D1
│   │   ├── delete-file.js      ✅ Delete from B2+D1
│   │   └── get-embed-url.js    ✅ Embed info API
│   └── embed/[id].js           ✅ Dynamic embeds
├── scripts/
│   └── hash-password.js        ✅ Password hash utility
├── schema.sql                  ✅ D1 schema
├── .dev.vars                   ✅ Local secrets
├── wrangler.toml               ✅ Cloudflare config
├── package.json                ✅ Scripts & deps
├── ARCHITECTURE.md             ✅ System overview
├── SETUP.md                    ✅ Setup guide
└── README.md                   ✅ Project readme
```

---

## Environment Variables Summary

### Production (Cloudflare Dashboard → Settings → Environment)

**Secrets** (encrypted in Cloudflare):
```
B2_KEY_ID=your_b2_key_id
B2_APP_KEY=your_b2_app_key
ADMIN_PASSWORD_HASH=14d761b854dd7d4883a3e60e92a322aefb53611e0c29f0de33f56351e3c84326
```

**Variables** (in `wrangler.toml`):
```
B2_BUCKET=contenthosting-media
B2_REGION=us-west-004
B2_ENDPOINT=s3.us-west-004.backblazeb2.com
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/contenthosting-media
```

### Local Development (.dev.vars)
```
# Already set with test credentials!
B2_KEY_ID=0050c60c9a40b88000000001
B2_APP_KEY=K00524kPAUscQsgo8AoikR5ANrZxwgs
B2_BUCKET=xpandorax
B2_REGION=us-east-005
B2_ENDPOINT=s3.us-east-005.backblazeb2.com
B2_PUBLIC_URL=https://f004.backblazeb2.com/file/xpandorax
ADMIN_PASSWORD_HASH=14d761b854dd7d4883a3e60e92a322aefb53611e0c29f0de33f56351e3c84326
```

---

## Quick Deployment Checklist

- [ ] Add B2_KEY_ID to Cloudflare secrets
- [ ] Add B2_APP_KEY to Cloudflare secrets  
- [ ] Add ADMIN_PASSWORD_HASH to Cloudflare secrets
- [ ] Run: `npm run deploy`
- [ ] Visit: `https://contenthosting.org/admin`
- [ ] Login with password: `KenKen111902!`
- [ ] Upload a test file
- [ ] Test embed URL works
- [ ] (Optional) Push to GitHub

---

## Troubleshooting

### "Failed to get upload URL"
- Check B2 credentials in Cloudflare secrets
- Verify B2 bucket exists and is public
- Check CORS rules are set (see SETUP.md Step 1.4)

### "CORS error" on upload
- Update B2 CORS rules to include your domain
- See SETUP.md Step 1.4 for configuration

### "File not found" on embed
- Check file was saved to D1
- Run: `wrangler d1 execute contenthosting-db --command="SELECT * FROM files;" --remote`

### Local dev not working
- Make sure .dev.vars has B2 credentials
- Run: `npm run dev` again
- Check port 8788 is not in use

---

## Additional Resources

- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Workers KV Docs](https://developers.cloudflare.com/workers/runtime-apis/kv/)
- [Backblaze B2 Docs](https://www.backblaze.com/b2/docs/)
- [Plyr.io Docs](https://plyr.io/)

---

## Support

For issues, check:
1. SETUP.md - Complete setup instructions
2. ARCHITECTURE.md - System overview
3. GitHub Issues - Report problems

---

**Project Status**: Ready for production deployment! 🚀
