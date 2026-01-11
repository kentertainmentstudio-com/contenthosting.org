/**
 * Register File API Endpoint
 * POST /api/register
 * 
 * Called after successful upload to B2.
 * Stores file metadata in Workers KV.
 */

import { verifyAuth } from './_auth-middleware.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const { fileId, filename, contentType, size, b2Key } = await request.json();
        
        // Validate input
        if (!fileId || !filename || !contentType || !b2Key) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Create metadata object
        const metadata = {
            fileId,
            filename,
            contentType,
            size: size || 0,
            b2Key,
            uploadDate: new Date().toISOString()
        };
        
        // Store in KV
        // Key format: file:{fileId}
        await env.CONTENT_KV.put(`file:${fileId}`, JSON.stringify(metadata));
        
        // Also add to the index list for easy listing
        // We'll store a simple index of all file IDs
        let fileIndex = [];
        try {
            const indexData = await env.CONTENT_KV.get('file_index');
            if (indexData) {
                fileIndex = JSON.parse(indexData);
            }
        } catch (e) {
            // Index doesn't exist yet, start fresh
        }
        
        // Add new file to beginning of index
        fileIndex.unshift(fileId);
        
        // Keep only last 1000 files in index
        if (fileIndex.length > 1000) {
            fileIndex = fileIndex.slice(0, 1000);
        }
        
        await env.CONTENT_KV.put('file_index', JSON.stringify(fileIndex));
        
        return new Response(JSON.stringify({ 
            success: true,
            fileId,
            metadata
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('Register error:', err);
        return new Response(JSON.stringify({ error: 'Failed to register file' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
