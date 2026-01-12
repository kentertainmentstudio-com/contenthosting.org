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
    // URL-encode the path segments properly for S3
    const pathSegments = parsedUrl.pathname.split('/');
    const encodedPath = pathSegments.map(segment => encodeURIComponent(segment)).join('/');
    
    // Current time
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    
    // Service is always s3 for S3-compatible APIs
    const service = 's3';
    
    // Credential scope
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Build canonical headers - always include host, optionally include others
    // For presigned URLs, we only sign the host header
    // Content-Type will be matched when the actual request is made
    const signedHeaders = 'host';
    const canonicalHeaders = `host:${host}\n`;
    
    // Query parameters for presigned URL
    const queryParams = new URLSearchParams({
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': signedHeaders
    });
    
    // Sort query parameters
    queryParams.sort();
    const canonicalQueryString = queryParams.toString();
    
    // For presigned URLs, payload is always UNSIGNED-PAYLOAD
    const hashedPayload = 'UNSIGNED-PAYLOAD';
    
    // Create canonical request
    const canonicalRequest = [
        method,
        encodedPath,
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
    
    // Add signature to query parameters
    queryParams.set('X-Amz-Signature', signature);
    
    // Build final URL - use the original pathname (not encoded) for the final URL
    // because the browser will encode it again when making the request
    return `${parsedUrl.origin}${parsedUrl.pathname}?${queryParams.toString()}`;
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
