/**
 * S3-Compatible Presigned URL Generator using AWS SDK
 * 
 * Uses AWS SDK for reliable signature generation with Backblaze B2's S3-compatible API.
 * This replaces our custom implementation with the battle-tested AWS SDK.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PresignedUrlOptions, PresignedPutUrlOptions } from '../types';

/**
 * Generate a presigned PUT URL for uploading using AWS SDK
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
    
    // Create S3 client configured for Backblaze B2
    const s3Client = new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${endpoint}`,
        forcePathStyle: true // Required for B2 compatibility
    });

    // Create the PUT command
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    });

    // Generate presigned URL
    const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn,
    });

    return presignedUrl;
}

/**
 * Generate a presigned GET URL for downloading using AWS SDK
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
    
    // Create S3 client configured for Backblaze B2
    const s3Client = new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${endpoint}`,
        forcePathStyle: true // Required for B2 compatibility
    });

    // Create the GET command
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });

    // Generate presigned URL
    const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn,
    });

    return presignedUrl;
}

/**
 * Delete an object from S3/B2 using AWS SDK
 */
export async function deleteObject({
    bucket,
    key,
    accessKeyId,
    secretAccessKey,
    region,
    endpoint
}: PresignedUrlOptions): Promise<boolean> {
    
    // Create S3 client configured for Backblaze B2
    const s3Client = new S3Client({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
        endpoint: `https://${endpoint}`,
        forcePathStyle: true // Required for B2 compatibility
    });

    try {
        // Create the DELETE command
        const command = new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        });

        // Execute the delete operation
        await s3Client.send(command);
        return true;
    } catch (error) {
        // If object doesn't exist (404), consider it successfully deleted
        if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
            return true;
        }
        throw error;
    }
}
