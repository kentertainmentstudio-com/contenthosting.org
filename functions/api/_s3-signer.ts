/**
 * S3-Compatible Presigned URL Generator using aws4 library
 * 
 * Uses the lightweight aws4 package for AWS Signature Version 4
 * Compatible with Cloudflare Workers and Backblaze B2's S3-compatible API.
 */

import aws4 from 'aws4';
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
    return generatePresignedUrl({
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
    return generatePresignedUrl({
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
    const url = generatePresignedUrl({
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
 * Core presigned URL generator using aws4
 */
function generatePresignedUrl({
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
}): string {
    
    const path = `/${bucket}/${key}`;
    
    // Build request options for aws4
    const opts: any = {
        host: endpoint,
        path: path,
        method: method,
        region: region,
        service: 's3',
        signQuery: true, // Generate presigned URL with signature in query string
        headers: {
            'Host': endpoint
        }
    };
    
    if (contentType) {
        opts.headers['Content-Type'] = contentType;
    }
    
    // Sign the request using aws4
    const signed = aws4.sign(opts, {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey
    });
    
    // Build the presigned URL from the signed request
    return `https://${endpoint}${signed.path}`;
}
