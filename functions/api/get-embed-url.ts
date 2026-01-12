/**
 * Get Embed URL API Endpoint
 * GET /api/get-embed-url
 * 
 * Returns embed information for a file (public endpoint).
 * Used by external services to get embed info.
 */

import type { PagesContext, FileMetadata, EmbedUrlResponse, ApiResponse } from '../types';

export async function onRequestGet(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
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
        const file = await env.DB.prepare(
            'SELECT id, filename, type, size, upload_date, b2_key, thumbnail_url, description FROM files WHERE id = ?'
        ).bind(fileId).first<FileMetadata>();
        
        if (!file) {
            return new Response(JSON.stringify({ error: 'File not found' } satisfies ApiResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const embedUrl = `https://contenthosting.org/embed/${file.id}`;
        const embedCode = `<iframe src="${embedUrl}" width="100%" height="450" frameborder="0" allowfullscreen></iframe>`;
        const mediaUrl = `${env.B2_PUBLIC_URL}/${file.b2_key}`;
        
        const response: EmbedUrlResponse = {
            fileId: file.id,
            filename: file.filename,
            type: file.type,
            size: file.size,
            uploadDate: file.upload_date,
            description: file.description,
            embedUrl,
            embedCode,
            mediaUrl,
            thumbnailUrl: file.thumbnail_url
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
        
    } catch (err) {
        console.error('Get embed URL error:', err);
        return new Response(JSON.stringify({ error: 'Failed to get embed URL' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
