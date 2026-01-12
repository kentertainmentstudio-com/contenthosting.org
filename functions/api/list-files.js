/**
 * List Files API Endpoint
 * GET /api/list-files
 * 
 * Returns list of all uploaded files from D1 database.
 * Supports optional search query parameter.
 */

import { verifyAuth } from './_auth-middleware.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const limit = parseInt(url.searchParams.get('limit')) || 100;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        
        let query;
        let params;
        
        if (search) {
            // Search by filename (case-insensitive)
            query = `
                SELECT id, filename, type, size, upload_date, b2_key, thumbnail_url, description
                FROM files
                WHERE filename LIKE ?
                ORDER BY upload_date DESC
                LIMIT ? OFFSET ?
            `;
            params = [`%${search}%`, limit, offset];
        } else {
            // Get all files
            query = `
                SELECT id, filename, type, size, upload_date, b2_key, thumbnail_url, description
                FROM files
                ORDER BY upload_date DESC
                LIMIT ? OFFSET ?
            `;
            params = [limit, offset];
        }
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        // Get total count
        const countResult = search 
            ? await env.DB.prepare('SELECT COUNT(*) as total FROM files WHERE filename LIKE ?').bind(`%${search}%`).first()
            : await env.DB.prepare('SELECT COUNT(*) as total FROM files').first();
        
        // Transform results to include public URLs
        const files = result.results.map(file => ({
            fileId: file.id,
            filename: file.filename,
            contentType: file.type,
            size: file.size,
            uploadDate: file.upload_date,
            b2Key: file.b2_key,
            thumbnailUrl: file.thumbnail_url,
            description: file.description,
            // Add public media URL
            mediaUrl: `${env.B2_PUBLIC_URL}/${file.b2_key}`
        }));
        
        return new Response(JSON.stringify({
            files,
            total: countResult?.total || 0,
            limit,
            offset
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('List files error:', err);
        return new Response(JSON.stringify({ error: 'Failed to list files' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
