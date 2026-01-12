/**
 * List Files API Endpoint
 * GET /api/list
 * 
 * Returns list of all uploaded files from KV.
 */

import { verifyAuth } from './_auth-middleware';
import type { PagesContext, KVFileMetadata, ApiResponse } from '../types';

export async function onRequestGet(context: PagesContext): Promise<Response> {
    const { request, env } = context;
    
    // Verify authentication
    const authError = await verifyAuth(request, env);
    if (authError) return authError;
    
    try {
        // Get file index
        const indexData = await env.CONTENT_KV.get('file_index');
        
        if (!indexData) {
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        const fileIndex = JSON.parse(indexData) as string[];
        
        // Fetch metadata for each file
        // Use Promise.all for parallel fetching (much faster)
        const files = await Promise.all(
            fileIndex.map(async (fileId): Promise<KVFileMetadata | null> => {
                const data = await env.CONTENT_KV.get(`file:${fileId}`);
                if (data) {
                    return JSON.parse(data) as KVFileMetadata;
                }
                return null;
            })
        );
        
        // Filter out any null entries (deleted files)
        const validFiles = files.filter((f): f is KVFileMetadata => f !== null);
        
        return new Response(JSON.stringify(validFiles), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('List error:', err);
        return new Response(JSON.stringify({ error: 'Failed to list files' } satisfies ApiResponse), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
