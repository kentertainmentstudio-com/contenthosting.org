/**
 * S3-Compatible Presigned URL Generator
 * 
 * Pure custom implementation using Web Crypto API
 * No external dependencies - compatible with Cloudflare Workers
 */

import type { PresignedUrlOptions, PresignedPutUrlOptions } from '../types';

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
    return await generatePresignedUrl({
        method: 'PUT',
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        region,
        endpoint,
        expiresIn,
        contentType
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
    return await generatePresignedUrl({
        method: 'GET',
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        region,
        endpoint,
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
    const url = await generatePresignedUrl({
        method: 'DELETE',
        bucket,
        key,
        accessKeyId,
        secretAccessKey,
        region,
        endpoint,
        expiresIn: 60
    });
    
    const response = await fetch(url, { method: 'DELETE' });
    return response.ok || response.status === 404;
}

// Helper to convert ArrayBuffer to hex
function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// Helper to perform HMAC-SHA256
async function hmacSha256(key: ArrayBuffer, data: string): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

// Derive signing key
async function getSigningKey(
    secretAccessKey: string,
    dateStamp: string,
    region: string,
    service: string
): Promise<ArrayBuffer> {
    const encoder = new TextEncoder();
    const kSecret = encoder.encode('AWS4' + secretAccessKey);
    
    const kDate = await hmacSha256(kSecret, dateStamp);
    const kRegion = await hmacSha256(kDate, region);
    const kService = await hmacSha256(kRegion, service);
    const kSigning = await hmacSha256(kService, 'aws4_request');
    
    return kSigning;
}

/**
 * Core presigned URL generator
 */
async function generatePresignedUrl({
    method,
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint,
    expiresIn,
    contentType
}: {
    method: 'GET' | 'PUT' | 'DELETE';
    bucket: string;
    key: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    expiresIn: number;
    contentType?: string;
}): Promise<string> {
    
    const encoder = new TextEncoder();
    const host = endpoint;
    const path = `/${bucket}/${key}`;
    
    // Current timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Build query parameters
    const params: Record<string, string> = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host'
    };
    
    // Sort and build canonical query string
    const sortedKeys = Object.keys(params).sort();
    const canonicalQueryString = sortedKeys
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
    
    // Build canonical request
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';
    
    const canonicalRequest = [
        method,
        path,
        canonicalQueryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');
    
    // Create string to sign
    const canonicalRequestHash = bufferToHex(
        await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest))
    );
    
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        canonicalRequestHash
    ].join('\n');
    
    // Calculate signature
    const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
    const signatureBuffer = await crypto.subtle.sign(
        { name: 'HMAC', hash: 'SHA-256' } as any,
        await crypto.subtle.importKey('raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']),
        encoder.encode(stringToSign)
    );
    const signature = bufferToHex(signatureBuffer);
    
    // Build final URL
    return `https://${host}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
