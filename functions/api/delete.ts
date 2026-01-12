/**
 * Delete File API Endpoint
 * POST /api/delete
 * 
 * Removes file metadata from KV and optionally from B2.
 */

import { verifyAuth } from './_auth-middleware';
import { deleteObject } from './_s3-signer';
import type { PagesContext, KVFileMetadata, ApiResponse } from '../types';

interface DeleteRequest {
    fileId?: string;
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const { fileId } = await request.json() as DeleteRequest;
        
        if (!fileId) {
            return new Response(JSON.stringify({ error: 'Missing fileId' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get file metadata
        const data = await env.CONTENT_KV.get(`file:${fileId}`);
        
        if (!data) {
            return new Response(JSON.stringify({ error: 'File not found' } satisfies ApiResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const metadata = JSON.parse(data) as KVFileMetadata;
        
        // Delete from B2 (optional - uncomment if you want to delete from storage too)
        try {
            await deleteObject({
                bucket: env.B2_BUCKET,
                key: metadata.b2Key,
                accessKeyId: env.B2_KEY_ID,
                secretAccessKey: env.B2_APP_KEY,
                region: env.B2_REGION,
                endpoint: env.B2_ENDPOINT
            });
        } catch (b2Err) {
            console.error('B2 delete error (continuing anyway):', b2Err);
            // Continue with KV deletion even if B2 delete fails
        }
        
        // Delete from KV
        await env.CONTENT_KV.delete(`file:${fileId}`);
        
        // Update file index
        let fileIndex: string[] = [];
        try {
            const indexData = await env.CONTENT_KV.get('file_index');
            if (indexData) {
                fileIndex = JSON.parse(indexData) as string[];
            }
        } catch {
            // Ignore
        }
        
        // Remove fileId from index
        fileIndex = fileIndex.filter(id => id !== fileId);
        await env.CONTENT_KV.put('file_index', JSON.stringify(fileIndex));
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'File deleted'
        } satisfies ApiResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('Delete error:', err);
        return new Response(JSON.stringify({ error: 'Failed to delete file' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
