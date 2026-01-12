/**
 * Type definitions for ContentHosting.org
 * 
 * Cloudflare Workers environment bindings and shared types.
 */

// Environment bindings for Cloudflare Workers
export interface Env {
    // D1 Database
    DB: D1Database;
    
    // KV Namespace for sessions
    CONTENT_KV: KVNamespace;
    
    // B2/S3 Configuration
    B2_BUCKET: string;
    B2_REGION: string;
    B2_ENDPOINT: string;
    B2_PUBLIC_URL: string;
    B2_KEY_ID: string;
    B2_APP_KEY: string;
    
    // Admin authentication
    ADMIN_PASSWORD_HASH: string;
}

// Cloudflare Pages function context
export interface PagesContext {
    request: Request;
    env: Env;
    params: Record<string, string>;
    waitUntil: (promise: Promise<unknown>) => void;
    passThroughOnException: () => void;
    next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
    data: Record<string, unknown>;
}

// File metadata stored in D1
export interface FileMetadata {
    id: string;
    filename: string;
    type: string;
    size: number;
    upload_date: string;
    b2_key: string;
    thumbnail_url: string | null;
    description: string | null;
}

// File metadata stored in KV (legacy)
export interface KVFileMetadata {
    fileId: string;
    filename: string;
    contentType: string;
    size: number;
    b2Key: string;
    uploadDate: string;
}

// API response types
export interface ApiResponse<T = unknown> {
    success?: boolean;
    error?: string;
    message?: string;
    data?: T;
}

export interface AuthResponse {
    success?: boolean;
    token?: string;
    error?: string;
}

export interface UploadUrlResponse {
    uploadUrl: string;
    fileId: string;
    b2Key: string;
}

export interface ListFilesResponse {
    files: TransformedFile[];
    total: number;
    limit: number;
    offset: number;
}

export interface TransformedFile {
    fileId: string;
    filename: string;
    contentType: string;
    size: number;
    uploadDate: string;
    b2Key: string;
    thumbnailUrl: string | null;
    description: string | null;
    mediaUrl: string;
}

export interface EmbedUrlResponse {
    fileId: string;
    filename: string;
    type: string;
    size: number;
    uploadDate: string;
    description: string | null;
    embedUrl: string;
    embedCode: string;
    mediaUrl: string;
    thumbnailUrl: string | null;
}

// S3 signing types
export interface PresignedUrlOptions {
    bucket: string;
    key: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    endpoint: string;
    expiresIn?: number;
}

export interface PresignedPutUrlOptions extends PresignedUrlOptions {
    contentType: string;
}

export interface SignOptions {
    method: 'GET' | 'PUT' | 'DELETE';
    url: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    expiresIn: number;
    headers?: Record<string, string>;
}

// Content type mapping
export type ContentTypeMap = {
    [key: string]: string;
};
