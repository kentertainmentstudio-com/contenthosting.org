/**
 * Delete File API Endpoint
 * DELETE /api/delete-file
 * 
 * Deletes a file from both B2 storage and D1 database.
 */

import { verifyAuth } from './_auth-middleware';
import { deleteObject } from './_s3-signer';
import type { PagesContext, FileMetadata, ApiResponse } from '../types';

export async function onRequestDelete(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const url = new URL(request.url);
        const fileId = url.searchParams.get('id');
        
        if (!fileId) {
            return new Response(JSON.stringify({ error: 'File ID required' } satisfies ApiResponse), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Get file metadata from D1
        const file = await env.DB.prepare('SELECT * FROM files WHERE id = ?').bind(fileId).first<FileMetadata>();
        
        if (!file) {
            return new Response(JSON.stringify({ error: 'File not found' } satisfies ApiResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Delete from B2
        try {
            await deleteObject({
                bucket: env.B2_BUCKET,
                key: file.b2_key,
                accessKeyId: env.B2_KEY_ID,
                secretAccessKey: env.B2_APP_KEY,
                region: env.B2_REGION,
                endpoint: env.B2_ENDPOINT
            });
        } catch (b2Error) {
            console.error('B2 delete error:', b2Error);
            // Continue to delete from D1 even if B2 fails
        }
        
        // Delete from D1
        const result = await env.DB.prepare('DELETE FROM files WHERE id = ?').bind(fileId).run();
        
        if (!result.success) {
            throw new Error('Database delete failed');
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'File deleted successfully'
        } satisfies ApiResponse), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        console.error('Delete error:', err);
        return new Response(JSON.stringify({ error: 'Failed to delete file' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Also support POST for compatibility
export async function onRequestPost(context: PagesContext): Promise<Response> {
    return onRequestDelete(context);
}

// Handle CORS preflight
export async function onRequestOptions(): Promise<Response> {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}
