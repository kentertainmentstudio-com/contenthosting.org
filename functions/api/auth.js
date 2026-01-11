/**
 * Authentication API Endpoint
 * POST /api/auth
 * 
 * Validates admin password and returns a session token.
 * Uses SHA-256 hash comparison for simplicity.
 */

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const { password } = await request.json();
        
        if (!password) {
            return new Response(JSON.stringify({ error: 'Password required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Hash the provided password
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Compare with stored hash
        const storedHash = env.ADMIN_PASSWORD_HASH;
        
        if (!storedHash) {
            console.error('ADMIN_PASSWORD_HASH not configured');
            return new Response(JSON.stringify({ error: 'Server configuration error' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (hashHex !== storedHash.toLowerCase()) {
            return new Response(JSON.stringify({ error: 'Invalid password' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // Generate a simple session token
        // In production, you might want to use JWT or store in KV with expiry
        const token = generateToken();
        
        // Store token in KV with 24-hour expiry
        await env.CONTENT_KV.put(`session:${token}`, 'valid', {
            expirationTtl: 86400 // 24 hours
        });
        
        return new Response(JSON.stringify({ 
            success: true,
            token 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
        
    } catch (err) {
        console.error('Auth error:', err);
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Generate a random token
 */
function generateToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
