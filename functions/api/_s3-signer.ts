/**
 * S3-Compatible Presigned URL Generator
 * 
 * Implements AWS Signature Version 4 for Backblaze B2's S3-compatible API.
 * Custom lightweight implementation compatible with Cloudflare Workers.
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
        expiresIn
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
    expiresIn
}: {
    method: 'GET' | 'PUT' | 'DELETE';
    bucket: string;
    key: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    expiresIn: number;
}): Promise<string> {
    
    const host = endpoint;
    const path = `/${bucket}/${key}`;
    
    // Current timestamp
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    
    const service = 's3';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    // Query parameters (must be in alphabetical order)
    const params: Record<string, string> = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${accessKeyId}/${credentialScope}`,
        'X-Amz-Date': amzDate,
        'X-Amz-Expires': expiresIn.toString(),
        'X-Amz-SignedHeaders': 'host'
    };
    
    // Build canonical query string
    const canonicalQueryString = Object.keys(params)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');
    
    // Build canonical request
    const canonicalRequest = [
        method,
        path,
        canonicalQueryString,
        `host:${host}\n`,
        'host',
        'UNSIGNED-PAYLOAD'
    ].join('\n');
    
    // String to sign
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        await sha256(canonicalRequest)
    ].join('\n');
    
    // Calculate signature
    const signingKey = await getSigningKey(secretAccessKey, dateStamp, region, service);
    const signature = await hmac(signingKey, stringToSign);
    
    // Return final URL
    return `https://${host}${path}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

/**
 * Get signing key
 */
async function getSigningKey(key: string, dateStamp: string, region: string, service: string): Promise<ArrayBuffer> {
    const kDate = await hmac(`AWS4${key}`, dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, service);
    return await hmac(kService, 'aws4_request');
}

/**
 * HMAC-SHA256
 */
async function hmac(key: string | ArrayBuffer, data: string): Promise<string | ArrayBuffer> {
    const keyData = typeof key === 'string' ? new TextEncoder().encode(key) : key;
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
    
    // Return hex string for final signature, ArrayBuffer for intermediate keys
    if (typeof key === 'string' && key.startsWith('AWS4')) {
        return signature; // Intermediate key
    }
    return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * SHA-256 hash
 */
async function sha256(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
