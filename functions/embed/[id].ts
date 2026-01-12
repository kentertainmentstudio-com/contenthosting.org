/**
 * Dynamic Embed Page Handler
 * GET /embed/{id}
 * 
 * Serves the embed page with the appropriate media player.
 * - Videos: Plyr.io player with modern controls
 * - Images: Responsive img tag centered on black background
 * 
 * Uses public B2 bucket URLs for permanent embedding (no expiration).
 * 
 * The page is designed to be embedded in iframes.
 */

import type { PagesContext, FileMetadata } from '../types';

export async function onRequestGet(context: PagesContext): Promise<Response> {
    const { params, env } = context;
    
    const fileId = params.id;
    
    if (!fileId) {
        return new Response('File ID required', { status: 400 });
    }
    
    try {
        // Get file metadata from D1 database
        const metadata = await env.DB.prepare(
            'SELECT id, filename, type, size, upload_date, b2_key, thumbnail_url, description FROM files WHERE id = ?'
        ).bind(fileId).first<FileMetadata>();
        
        if (!metadata) {
            return new Response(notFoundPage(), {
                status: 404,
                headers: { 'Content-Type': 'text/html' }
            });
        }
        
        // Use public B2 URL for permanent embedding (no expiration)
        const mediaUrl = `${env.B2_PUBLIC_URL}/${metadata.b2_key}`;
        
        const isVideo = metadata.type.startsWith('video/');
        
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
                // Cache the HTML page for 1 hour
                'Cache-Control': 'public, max-age=3600'
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
function videoEmbedPage(url: string, metadata: FileMetadata): string {
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
            <source src="${escapeHtml(url)}" type="${escapeHtml(metadata.type)}" />
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
function imageEmbedPage(url: string, metadata: FileMetadata): string {
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
function notFoundPage(): string {
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
function errorPage(message: string): string {
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
function escapeHtml(str: string | null): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
