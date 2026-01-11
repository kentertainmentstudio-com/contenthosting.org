/**
 * Dynamic Embed Page Handler
 * GET /embed/{id}
 * 
 * Serves the embed page with the appropriate media player.
 * - Videos: Plyr.io player with modern controls
 * - Images: Responsive img tag centered on black background
 * 
 * Supports both:
 * - Public buckets: Direct URL to B2 (no signing needed)
 * - Private buckets: Signed URLs with configurable expiry
 * 
 * The page is designed to be embedded in iframes.
 */

import { generatePresignedGetUrl } from '../api/_s3-signer.js';

export async function onRequestGet(context) {
    const { params, env } = context;
    
    const fileId = params.id;
    
    if (!fileId) {
        return new Response('File ID required', { status: 400 });
    }
    
    try {
        // Get file metadata from KV
        const data = await env.CONTENT_KV.get(`file:${fileId}`);
        
        if (!data) {
            return new Response(notFoundPage(), {
                status: 404,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        const metadata = JSON.parse(data);
        
        // Determine media URL based on bucket type
        let mediaUrl;
        
        if (env.B2_PUBLIC_URL) {
            // Public bucket: Use direct URL (no signing needed)
            // Format: https://f004.backblazeb2.com/file/bucket-name/path/to/file.mp4
            mediaUrl = `${env.B2_PUBLIC_URL}/${metadata.b2Key}`;
        } else {
            // Private bucket: Generate signed URL
            // Default to 6 hour expiry for embeds (balances security and usability)
            mediaUrl = await generatePresignedGetUrl({
                bucket: env.B2_BUCKET,
                key: metadata.b2Key,
                accessKeyId: env.B2_KEY_ID,
                secretAccessKey: env.B2_APP_KEY,
                region: env.B2_REGION,
                endpoint: env.B2_ENDPOINT,
                expiresIn: 21600 // 6 hours for embed pages
            });
        }
        
        const isVideo = metadata.contentType.startsWith('video/');
        
        // Generate the appropriate embed page
        const html = isVideo 
            ? videoEmbedPage(mediaUrl, metadata)
            : imageEmbedPage(mediaUrl, metadata);
        
        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
                // Allow embedding from any origin
                'X-Frame-Options': 'ALLOWALL',
                'Content-Security-Policy': "frame-ancestors *;",
                // Cache the HTML page for 5 minutes (URL will still work due to longer expiry)
                'Cache-Control': 'public, max-age=300'
            }
        });
        
    } catch (err) {
        console.error('Embed error:', err);
        return new Response(errorPage('Error loading media'), {
            status: 500,
            headers: { 'Content-Type': 'text/html' }
        });
    }
}

/**
 * Generate video embed page with Plyr.io
 */
function videoEmbedPage(url, metadata) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(metadata.filename)}</title>
    <link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css" />
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #000; 
            overflow: hidden;
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .plyr { width: 100%; height: 100%; }
        .plyr--video { height: 100%; }
        .plyr__video-wrapper { height: 100%; }
        video { 
            width: 100%; 
            height: 100%; 
            object-fit: contain;
        }
    </style>
</head>
<body>
    <div class="container">
        <video id="player" playsinline controls>
            <source src="${escapeHtml(url)}" type="${escapeHtml(metadata.contentType)}" />
        </video>
    </div>
    <script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
    <script>
        const player = new Plyr('#player', {
            controls: [
                'play-large', 'play', 'progress', 'current-time', 
                'mute', 'volume', 'settings', 'pip', 'airplay', 'fullscreen'
            ],
            settings: ['quality', 'speed'],
            ratio: '16:9',
            hideControls: true,
            resetOnEnd: false,
            keyboard: { focused: true, global: true }
        });
    </script>
</body>
</html>`;
}

/**
 * Generate image embed page
 */
function imageEmbedPage(url, metadata) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(metadata.filename)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #000; 
            overflow: hidden;
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
        }
    </style>
</head>
<body>
    <div class="container">
        <img src="${escapeHtml(url)}" alt="${escapeHtml(metadata.filename)}" />
    </div>
</body>
</html>`;
}

/**
 * 404 page
 */
function notFoundPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Not Found</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #000;
            color: #666;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <p>Media not found</p>
    </div>
</body>
</html>`;
}

/**
 * Error page
 */
function errorPage(message) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            width: 100%; 
            height: 100%; 
            background: #000;
            color: #ef4444;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
