// src/schemas/storageSchemas.ts
import { z } from '@hono/zod-openapi';
import {
    GeneralNotFoundErrorSchema,
    GeneralServerErrorSchema
} from './common.schemas';

// Define the R2 bucket names based on wrangler.jsonc and env.d.ts
// These should match the bindings configured in your wrangler.jsonc and CloudflareEnv interface
export const R2BucketNameSchema = z.enum([
    'POST_PROJECTS_BUCKET',
    'DEFAULT_FILES_BUCKET'
]).openapi('R2BucketName');



// Schema for GetUploadUrl request
export const GetPresignedUrlToUploadRequestSchema = z.object({
    bucket: R2BucketNameSchema.openapi({ param: { name: 'bucket', in: 'query', required: true }, description: 'Logical name of the target R2 bucket for upload.' }),
    key: z.string().min(1).openapi({ param: { name: 'key', in: 'query', required: true }, example: 'uploads/myfile.png', description: 'The desired object key (path and filename) for the upload.' }),
    contentType: z.string().optional().openapi({ param: { name: 'contentType', in: 'query', required: false }, example: 'image/png', description: 'MIME type of the file to be uploaded. If not provided, the uploader will need to set it.' }),
}).openapi('GetPresignedUrlToUploadRequest');

// Schema for GetUploadUrl success response
export const GetPresignedUrlToUploadSuccessResponseSchema = z.object({
    url: z.string().url().openapi({ example: 'https://presigned-url-for-upload...', description: 'The presigned URL to use for uploading the file.' }),
    method: z.literal('PUT').openapi({ description: 'The HTTP method to use with the presigned URL (always PUT for uploads).' }),
}).openapi('GetPresignedUrlToUploadSuccessResponse');

// Schema for GetPresignedUrlToDownload request
export const GetPresignedUrlToDownloadRequestSchema = z.object({
    bucket: R2BucketNameSchema.openapi({ param: { name: 'bucket', in: 'query', required: true }, description: 'Logical name of the target R2 bucket for download.' }),
    key: z.string().min(1).openapi({ param: { name: 'key', in: 'query', required: true }, example: 'downloads/myfile.png', description: 'The desired object key (path and filename) for the download.' }),
}).openapi('GetPresignedUrlToDownloadRequest');

// Schema for GetPresignedUrlToDownload success response
export const GetPresignedUrlToDownloadSuccessResponseSchema = z.object({
    url: z.string().url().openapi({ example: 'https://presigned-url-for-download...', description: 'The presigned URL to use for downloading the file.' }),
    method: z.literal('GET').openapi({ description: 'The HTTP method to use with the presigned URL (always GET for downloads).' }),
}).openapi('GetPresignedUrlToDownloadSuccessResponse');

// Schema for GetPresignedUrlToDelete request
export const GetPresignedUrlToDeleteRequestSchema = z.object({
    bucket: R2BucketNameSchema.openapi({ param: { name: 'bucket', in: 'query', required: true }, description: 'Logical name of the target R2 bucket for deletion.' }),
    key: z.string().min(1).openapi({ param: { name: 'key', in: 'query', required: true }, example: 'to-delete/myfile.png', description: 'The desired object key (path and filename) for deletion.' }),
}).openapi('GetPresignedUrlToDeleteRequest');

// Schema for GetPresignedUrlToDelete success response
export const GetPresignedUrlToDeleteSuccessResponseSchema = z.object({
    url: z.string().url().openapi({ example: 'https://presigned-url-for-delete...', description: 'The presigned URL to use for deleting the file.' }),
    method: z.literal('DELETE').openapi({ description: 'The HTTP method to use with the presigned URL (always DELETE for deletions).' }),
}).openapi('GetPresignedUrlToDeleteSuccessResponse');

// Schema for GetPresignedUrlToHead request
export const GetPresignedUrlToHeadRequestSchema = z.object({
    bucket: R2BucketNameSchema.openapi({ param: { name: 'bucket', in: 'query', required: true }, description: 'Logical name of the target R2 bucket for head operation.' }),
    key: z.string().min(1).openapi({ param: { name: 'key', in: 'query', required: true }, example: 'check-metadata/myfile.png', description: 'The desired object key (path and filename) for head operation.' }),
}).openapi('GetPresignedUrlToHeadRequest');

// Schema for GetPresignedUrlToHead success response
export const GetPresignedUrlToHeadSuccessResponseSchema = z.object({
    url: z.string().url().openapi({ example: 'https://presigned-url-for-head...', description: 'The presigned URL to use for head operation.' }),
    method: z.literal('HEAD').openapi({ description: 'The HTTP method to use with the presigned URL (always HEAD for head operations).' }),
}).openapi('GetPresignedUrlToHeadSuccessResponse');

// --- Error Schemas for Storage Operations ---

export const BucketNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
    message: z.literal("The specified bucket binding was not found or is not configured."),
    bucketNameAttempted: z.string().optional().openapi({ example: 'INVALID_BUCKET_NAME' })
}).openapi('BucketNotFoundError');

export const R2OperationErrorSchema = GeneralServerErrorSchema.extend({
    message: z.string().openapi({ example: 'An error occurred while interacting with R2 storage.' }),
    details: z.string().optional().openapi({ example: 'R2 put operation failed due to an internal R2 error.' })
}).openapi('R2OperationError');
