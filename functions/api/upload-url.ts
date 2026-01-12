/**
 * Upload URL API Endpoint
 * POST /api/upload-url
 * 
 * Generates a presigned URL for direct browser-to-B2 upload.
 * This bypasses Worker body size limits (100MB free tier).
 * 
 * Uses S3-compatible API with AWS Signature V4.
 */

import { verifyAuth } from './_auth-middleware';
import { generatePresignedPutUrl } from './_s3-signer';
import type { PagesContext, UploadUrlResponse, ApiResponse, ContentTypeMap } from '../types';

interface UploadUrlRequest {
    filename?: string;
    contentType?: string;
    size?: number;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const { filename, contentType, size } = await request.json() as UploadUrlRequest;
        
        // Validate input
        if (!filename || !contentType) {
            return new Response(JSON.stringify({ error: 'Missing filename or contentType' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate file type (support common MIME type variations)
        const isValidType = 
            contentType === 'video/mp4' ||
            contentType === 'video/webm' ||
            contentType === 'image/jpeg' ||
            contentType.startsWith('image/png') ||
            contentType === 'image/gif' ||
            contentType === 'image/x-png'; // Support alternate PNG MIME type
        
        if (!isValidType) {
            return new Response(JSON.stringify({ error: 'Invalid file type' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate file size (500MB max)
        const maxSize = 500 * 1024 * 1024;
        if (size && size > maxSize) {
            return new Response(JSON.stringify({ error: 'File too large (max 500MB)' } satisfies ApiResponse), {
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
        
        const response: UploadUrlResponse = {
            uploadUrl,
            fileId,
            b2Key
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        console.error('Upload URL error:', err);
        return new Response(JSON.stringify({ error: 'Failed to generate upload URL' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Get file extension from filename or content type
 */
function getExtension(filename: string, contentType: string): string {
    // Try to get from filename
    const match = filename.match(/\.[a-zA-Z0-9]+$/);
    if (match) return match[0].toLowerCase();
    
    // Fallback to content type
    const typeMap: ContentTypeMap = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif'
    };
    
    return typeMap[contentType] || '';
}
