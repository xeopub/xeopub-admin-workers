// api-worker/src/env.d.ts

// Import Cloudflare Worker specific types. These should be globally available
// if @cloudflare/workers-types is correctly configured in tsconfig.json's 'types' array,
// but explicit imports can sometimes help resolve stubborn issues.
import type { D1Database, R2Bucket, Fetcher } from '@cloudflare/workers-types';

export interface CloudflareEnv {
    // AWS S3 SDK / R2 Configuration
    R2_S3_ENDPOINT: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_REGION: string; // e.g., 'auto', 'us-east-1'
    POST_PROJECTS_BUCKET_NAME: string; // Actual R2 bucket name
    DEFAULT_FILES_BUCKET_NAME: string; // Actual R2 bucket name

    // Bindings defined in wrangler.toml and generated in worker-configuration.d.ts
    ENVIRONMENT: string;
    POST_PROJECTS_BUCKET: R2Bucket;
    DEFAULT_FILES_BUCKET: R2Bucket;
    DB: D1Database;
    ASSETS: Fetcher;
    HEAVY_COMPUTE_API_KEY: string; // Existing binding

    // Add any other KV Namespaces, Durable Objects, etc., bound to this worker
    // e.g., MY_KV_NAMESPACE: KVNamespace;
}