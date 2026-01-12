/**
 * Sign URL API Endpoint
 * GET /api/sign-url?fileId=xxx
 * 
 * Generates a signed URL for accessing a file from B2.
 * URLs are short-lived (30 minutes) for security.
 */

import { generatePresignedGetUrl } from './_s3-signer';
import type { PagesContext, KVFileMetadata, ApiResponse } from '../types';

interface SignUrlResponse {
    url: string;
    contentType: string;
    filename: string;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    try {
        const url = new URL(request.url);
        const fileId = url.searchParams.get('fileId');
        
        if (!fileId) {
            return new Response(JSON.stringify({ error: 'Missing fileId' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get file metadata from KV
        const data = await env.CONTENT_KV.get(`file:${fileId}`);
        
        if (!data) {
            return new Response(JSON.stringify({ error: 'File not found' } satisfies ApiResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const metadata = JSON.parse(data) as KVFileMetadata;
        
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
        
        const response: SignUrlResponse = {
            url: signedUrl,
            contentType: metadata.contentType,
            filename: metadata.filename
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                // Allow this endpoint to be called from embed pages
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        console.error('Sign URL error:', err);
        return new Response(JSON.stringify({ error: 'Failed to generate signed URL' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle CORS preflight
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    });
}
