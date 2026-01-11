/**
 * Authentication Middleware
 * 
 * Shared function to verify auth token from request headers.
 * Import this in any endpoint that requires authentication.
 */

export async function verifyAuth(request, env) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const token = authHeader.slice(7); // Remove 'Bearer '
    
    // Check if token exists in KV
    const sessionData = await env.CONTENT_KV.get(`session:${token}`);
    
    if (!sessionData) {
        return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // Token is valid
    return null;
}
