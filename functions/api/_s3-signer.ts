/**
 * S3-Compatible Presigned URL Generator
 * 
 * Implements AWS Signature Version 4 for Backblaze B2's S3-compatible API.
 * Used to generate presigned URLs for uploads and downloads.
 * 
 * This is a minimal implementation focused on the operations we need:
 * - PUT (upload)
 * - GET (download)
 * - DELETE (remove)
 */

import type { PresignedUrlOptions, PresignedPutUrlOptions, SignOptions } from '../types';

/**
 * Generate a presigned PUT URL for uploading
 */
export async function generatePresignedPutUrl({
    bucket,
    key,
    contentType,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    expiresIn = 3600
}: PresignedPutUrlOptions): Promise<string> {
    const url = `https://${endpoint}/${bucket}/${key}`;
    return await sign({
        method: 'PUT',
        url,
        accessKeyId,
        secretAccessKey,
        region,
        expiresIn,
        headers: {
            'Content-Type': contentType
        }
    });
}

/**
 * Generate a presigned GET URL for downloading
 */
export async function generatePresignedGetUrl({
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    expiresIn = 1800
}: PresignedUrlOptions): Promise<string> {
    const url = `https://${endpoint}/${bucket}/${key}`;
    return await sign({
        method: 'GET',
        url,
        accessKeyId,
        secretAccessKey,
        region,
        expiresIn
    });
}

/**
 * Delete an object from S3/B2
 */
export async function deleteObject({
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint
}: PresignedUrlOptions): Promise<boolean> {
    const url = `https://${endpoint}/${bucket}/${key}`;
    const signedUrl = await sign({
        method: 'DELETE',
        url,
        accessKeyId,
        secretAccessKey,
        region,
        expiresIn: 60
    });
    
    const response = await fetch(signedUrl, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) {
        throw new Error(`Delete failed: ${response.status}`);
    }
    return true;
}

/**
 * AWS Signature V4 Implementation
 * Creates a presigned URL with query string authentication
 */
async function sign({
    method,
    url,
    accessKeyId,
    secretAccessKey,
    region,
    expiresIn,
    // headers parameter kept for API compatibility (future use for signed headers)
    headers: _headers = {}
}: SignOptions): Promise<string> {
    const parsedUrl = new URL(url);
    const host = parsedUrl.host;
    
    // Current time
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // Service is always s3 for S3-compatible APIs
    const service = 's3';
    
    // Credential scope
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Canonical URI (path) - must be properly encoded
    const canonicalUri = encodePath(parsedUrl.pathname);
    
    // Build canonical headers - host must be lowercase
    const canonicalHeaders = `host:${host.toLowerCase()}\n`;
    const signedHeaders = 'host';
    
    // Query parameters for presigned URL
    const params = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': signedHeaders
    };
    
    // Create canonical query string (sorted keys)
    const canonicalQueryString = Object.keys(params)
        .sort()
        .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key as keyof typeof params])}`)
        .join('&');
    
    // Payload for presigned URLs is always UNSIGNED-PAYLOAD
    const hashedPayload = 'UNSIGNED-PAYLOAD';
    
    // Create canonical request
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        hashedPayload
    ].join('\n');
    
    // Hash the canonical request
    const canonicalRequestHash = await sha256Hex(canonicalRequest);
    
    // Create string to sign
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHash
    ].join('\n');
    
    // Calculate signing key
    const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
    
    // Calculate signature
    const signature = await hmacSha256Hex(signingKey, stringToSign);
    
    // Build final URL
    const finalQueryString = canonicalQueryString + '&X-Amz-Signature=' + encodeURIComponent(signature);
    
    return `${parsedUrl.protocol}//${host}${canonicalUri}?${finalQueryString}`;
}

/**
 * Encode path according to AWS requirements
 */
function encodePath(path: string): string {
    return path.split('/').map(segment => {
        // Don't encode if it's empty (leading slash)
        if (!segment) return segment;
        
        // AWS-style encoding: encode everything except unreserved characters
        return encodeURIComponent(segment)
            .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }).join('/');
}

/**
 * S3-specific URI encoding - DEPRECATED, using standard encoding above
 */
function s3UriEncode(str: string): string {
    if (!str) return str;
    
    let encoded = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        // Unreserved characters per RFC 3986
        if (
            (char >= 'A' && char <= 'Z') ||
            (char >= 'a' && char <= 'z') ||
            (char >= '0' && char <= '9') ||
            char === '-' ||
            char === '_' ||
            char === '.' ||
            char === '~'
        ) {
            encoded += char;
        } else {
            // Percent-encode everything else
            encoded += '%' + char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
        }
    }
    return encoded;
}

/**
 * Calculate the signing key
 */
async function getSignatureKey(
    key: string,
    dateStamp: string,
    region: string,
    service: string
): Promise<ArrayBuffer> {
    const kDate = await hmacSha256(`AWS4${key}`, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    return kSigning;
}

/**
 * HMAC-SHA256 returning ArrayBuffer
 */
async function hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const keyBuffer = typeof key === 'string' 
        ? new TextEncoder().encode(key) 
        : key;
    
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const dataBuffer = new TextEncoder().encode(data);
    return await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
}

/**
 * HMAC-SHA256 returning hex string
 */
async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
    const result = await hmacSha256(key, data);
    return arrayBufferToHex(result);
}

/**
 * SHA-256 hash returning hex string
 */
async function sha256Hex(data: string): Promise<string> {
    const buffer = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return arrayBufferToHex(hash);
}

/**
 * Convert ArrayBuffer to hex string
 */
function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
