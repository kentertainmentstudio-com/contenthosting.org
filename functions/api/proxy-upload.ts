/**
 * Proxy Upload API Endpoint
 * POST /api/proxy-upload
 * 
 * Uploads file through Cloudflare Worker to bypass B2 CORS issues.
 * This is a fallback for when direct browser-to-B2 upload fails.
 * 
 * Note: Cloudflare Workers free tier has 100MB request body limit.
 * For files larger than 100MB, use the presigned URL approach with B2 CORS configured.
 */

import { verifyAuth } from './_auth-middleware';
import { generatePresignedPutUrl } from './_s3-signer';
import type { PagesContext, ApiResponse, ContentTypeMap } from '../types';

interface ProxyUploadResponse {
    success: boolean;
    fileId: string;
    b2Key: string;
    uploadDate: string;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        // Get the form data
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const filename = formData.get('filename') as string || file?.name || 'unnamed';
        
        if (!file) {
            return new Response(JSON.stringify({ error: 'No file provided' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const contentType = file.type;
        const size = file.size;
        
        // Validate file type
        const isValidType = 
            contentType === 'video/mp4' ||
            contentType === 'video/webm' ||
            contentType === 'image/jpeg' ||
            contentType.startsWith('image/png') ||
            contentType === 'image/gif' ||
            contentType === 'image/x-png';
        
        if (!isValidType) {
            return new Response(JSON.stringify({ error: 'Invalid file type. Supported: MP4, WebM, JPG, PNG, GIF' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Validate file size (100MB max for proxy upload due to Worker limits)
        const maxSize = 100 * 1024 * 1024;
        if (size > maxSize) {
            return new Response(JSON.stringify({ error: 'File too large for proxy upload (max 100MB). Please configure B2 CORS for larger files.' } satisfies ApiResponse), {
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
        
        // Generate presigned PUT URL
        const uploadUrl = await generatePresignedPutUrl({
            bucket: env.B2_BUCKET,
            key: b2Key,
            contentType,
            accessKeyId: env.B2_KEY_ID,
            secretAccessKey: env.B2_APP_KEY,
            region: env.B2_REGION,
            endpoint: env.B2_ENDPOINT,
            expiresIn: 3600
        });
        
        // Log URL for debugging (mask sensitive parts)
        console.log('Upload URL generated for bucket:', env.B2_BUCKET, 'key:', b2Key);
        console.log('Using endpoint:', env.B2_ENDPOINT, 'region:', env.B2_REGION);
        
        // Upload the file to B2 through the Worker
        const fileBuffer = await file.arrayBuffer();
        const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType,
                'Content-Length': size.toString()
            },
            body: fileBuffer
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('B2 upload failed:', uploadResponse.status, errorText);
            console.error('Response headers:', JSON.stringify(Object.fromEntries(uploadResponse.headers.entries())));
            throw new Error(`B2 upload failed: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
        }
        
        // Register the upload in D1 database
        const uploadDate = new Date().toISOString();
        let thumbnailUrl: string | null = null;
        if (contentType.startsWith('image/')) {
            thumbnailUrl = `${env.B2_PUBLIC_URL}/${b2Key}`;
        }
        
        const result = await env.DB.prepare(`
            INSERT INTO files (id, filename, type, size, upload_date, b2_key, thumbnail_url, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            fileId,
            filename,
            contentType,
            size,
            uploadDate,
            b2Key,
            thumbnailUrl,
            null
        ).run();
        
        if (!result.success) {
            throw new Error('Database insert failed');
        }
        
        const response: ProxyUploadResponse = {
            success: true,
            fileId,
            b2Key,
            uploadDate
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Proxy upload error:', errorMsg, err);
        return new Response(JSON.stringify({ error: `Upload failed: ${errorMsg}` } satisfies ApiResponse), {
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
    
    // Fallback to content type (normalize PNG MIME type variants)
    const normalizedType = contentType === 'image/x-png' ? 'image/png' : contentType;
    const typeMap: ContentTypeMap = {
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif'
    };
    
    return typeMap[normalizedType] || '';
}

// Handle CORS preflight
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}
