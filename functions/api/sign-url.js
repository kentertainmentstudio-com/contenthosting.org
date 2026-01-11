/**
 * Sign URL API Endpoint
 * GET /api/sign-url?fileId=xxx
 * 
 * Generates a signed URL for accessing a file from B2.
 * URLs are short-lived (30 minutes) for security.
 */

import { generatePresignedGetUrl } from './_s3-signer.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    try {
        const url = new URL(request.url);
        const fileId = url.searchParams.get('fileId');
        
        if (!fileId) {
            return new Response(JSON.stringify({ error: 'Missing fileId' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get file metadata from KV
        const data = await env.CONTENT_KV.get(`file:${fileId}`);
        
        if (!data) {
            return new Response(JSON.stringify({ error: 'File not found' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const metadata = JSON.parse(data);
        
        // Generate signed GET URL (valid for 30 minutes)
        const signedUrl = await generatePresignedGetUrl({
            bucket: env.B2_BUCKET,
            key: metadata.b2Key,
            accessKeyId: env.B2_KEY_ID,
            secretAccessKey: env.B2_APP_KEY,
            region: env.B2_REGION,
            endpoint: env.B2_ENDPOINT,
            expiresIn: 1800 // 30 minutes
        });
        
        return new Response(JSON.stringify({
            url: signedUrl,
            contentType: metadata.contentType,
            filename: metadata.filename
        }), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                // Allow this endpoint to be called from embed pages
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        console.error('Sign URL error:', err);
        return new Response(JSON.stringify({ error: 'Failed to generate signed URL' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle CORS preflight
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
