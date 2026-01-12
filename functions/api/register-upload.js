/**
 * Register Upload API Endpoint
 * POST /api/register-upload
 * 
 * Saves file metadata to D1 database after successful B2 upload.
 */

import { verifyAuth } from './_auth-middleware.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const { fileId, filename, contentType, size, b2Key, description } = await request.json();
        
        // Validate required fields
        if (!fileId || !filename || !contentType || !b2Key) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Generate thumbnail URL (for images, use the image itself; for videos, use placeholder)
        let thumbnailUrl = null;
        if (contentType.startsWith('image/')) {
            thumbnailUrl = `${env.B2_PUBLIC_URL}/${b2Key}`;
        }
        // For videos, we leave thumbnailUrl as null (frontend will show video icon)
        
        const uploadDate = new Date().toISOString();
        
        // Insert into D1 database
        const result = await env.DB.prepare(`
            INSERT INTO files (id, filename, type, size, upload_date, b2_key, thumbnail_url, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            fileId,
            filename,
            contentType,
            size || 0,
            uploadDate,
            b2Key,
            thumbnailUrl,
            description || null
        ).run();
        
        if (!result.success) {
            throw new Error('Database insert failed');
        }
        
        return new Response(JSON.stringify({
            success: true,
            fileId,
            filename,
            uploadDate
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('Register upload error:', err);
        return new Response(JSON.stringify({ error: 'Failed to register file' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
