/**
 * Presigned POST URL API Endpoint
 * POST /api/presigned-post
 * 
 * Generates a presigned URL for direct browser-to-B2 upload.
 * This bypasses Worker body size limits (100MB free tier).
 * 
 * Uses S3-compatible API with AWS Signature V4.
 */

import { verifyAuth } from './_auth-middleware.js';
import { generatePresignedPutUrl } from './_s3-signer.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const { filename, contentType, size } = await request.json();
        
        // Validate input
        if (!filename || !contentType) {
            return new Response(JSON.stringify({ error: 'Missing filename or contentType' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate file type
        const allowedTypes = ['video/mp4', 'video/webm', 'image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(contentType)) {
            return new Response(JSON.stringify({ error: 'Invalid file type' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate file size (500MB max)
        const maxSize = 500 * 1024 * 1024;
        if (size > maxSize) {
            return new Response(JSON.stringify({ error: 'File too large (max 500MB)' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Generate unique file ID
        const fileId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        
        // Determine folder based on type
        const folder = contentType.startsWith('video/') ? 'videos' : 'images';
        
        // Create B2 key (path in bucket)
        const extension = getExtension(filename, contentType);
        const b2Key = `${folder}/${fileId}${extension}`;
        
        // Generate presigned PUT URL (valid for 1 hour)
        const uploadUrl = await generatePresignedPutUrl({
            bucket: env.B2_BUCKET,
            key: b2Key,
            contentType,
            accessKeyId: env.B2_KEY_ID,
            secretAccessKey: env.B2_APP_KEY,
            region: env.B2_REGION,
            endpoint: env.B2_ENDPOINT,
            expiresIn: 3600 // 1 hour
        });
        
        return new Response(JSON.stringify({
            uploadUrl,
            fileId,
            b2Key
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('Presigned POST error:', err);
        return new Response(JSON.stringify({ error: 'Failed to generate upload URL' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Get file extension from filename or content type
 */
function getExtension(filename, contentType) {
    // Try to get from filename
    const match = filename.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0].toLowerCase();
    
    // Fallback to content type
    const typeMap = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif'
    };
    
    return typeMap[contentType] || '';
}
