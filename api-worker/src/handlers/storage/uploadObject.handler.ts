// src/handlers/storage/uploadObject.handler.ts
import { z } from 'zod';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import type { Handler } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import type { CloudflareEnv } from '../../env';
import {
    // UploadObjectFormSchema, // This is not used by the handler directly for validation
    UploadObjectSuccessResponseSchema,
    BucketNotFoundErrorSchema,
    FileUploadErrorSchema,
    R2OperationErrorSchema,
    InvalidKeyErrorSchema,
    InvalidCustomMetadataErrorSchema,
    MissingContentTypeErrorSchema,
    R2BucketNameSchema
} from '../../schemas/storageSchemas';
import { GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas'; // For the ZodError catch block
import { getR2Bucket } from './utils'; // Import from shared utils

// Helper to sanitize the key
function sanitizeKey(key: string): string {
    // Remove leading/trailing slashes and replace multiple slashes with a single one
    let sanitized = key.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\/{2,}/g, '/');
    // Basic security: prevent path traversal by removing ../ sequences
    sanitized = sanitized.replace(/\.\.\//g, '');
    // Ensure key is not excessively long (R2 has a 1024 byte limit for object keys)
    if (new TextEncoder().encode(sanitized).length > 900) { // Leave some room for prefixes if any
        sanitized = sanitized.substring(0, sanitized.lastIndexOf('/', 850) || 850); // Try to cut at a slash
    }
    return sanitized;
}

export const uploadObjectHandler: Handler<{
    Bindings: CloudflareEnv,
    Variables: {},
    // Hono's built-in c.req.formData() is used, so we don't need to type it here via `in`
    // The `json` property of `zValidator` is for JSON bodies, not multipart/form-data.
    // We will parse formData manually in the handler.
}> = async (c) => {
    try {
        const formData = await c.req.formData();

        const file = formData.get('file');
        const bucketNameInput = formData.get('bucket');
        let keyInput = formData.get('key');
        let contentTypeInput = formData.get('contentType');
        const customMetadataInput = formData.get('customMetadata');

        if (!(file instanceof File)) {
            return c.json(FileUploadErrorSchema.parse({
                success: false,
                message: 'File upload failed. No file provided in the \'file\' field or invalid form data.'
            }), 400);
        }

        if (typeof bucketNameInput !== 'string') {
             return c.json(FileUploadErrorSchema.parse({
                success: false,
                message: 'Bucket name is required and must be a string.'
            }), 400);
        }

        const parsedBucketName = R2BucketNameSchema.safeParse(bucketNameInput);
        if (!parsedBucketName.success) {
            return c.json(BucketNotFoundErrorSchema.parse({
                success: false,
                message: `Invalid bucket name provided: ${bucketNameInput}. Valid names are: ${R2BucketNameSchema.options.join(', ')}`,
                bucketNameAttempted: bucketNameInput
            }), 400);
        }
        const logicalBucketName = parsedBucketName.data;

        const bucket = getR2Bucket(c, logicalBucketName);
        if (!bucket) {
            return c.json(BucketNotFoundErrorSchema.parse({
                success: false,
                message: 'The specified bucket binding was not found or is not configured.',
                bucketNameAttempted: logicalBucketName
            }), 500);
        }

        let objectKey: string;
        if (typeof keyInput === 'string' && keyInput.trim() !== '') {
            objectKey = sanitizeKey(keyInput.trim());
            if (!objectKey) { // SanitizeKey might return empty if original key was just slashes
                 return c.json(InvalidKeyErrorSchema.parse({
                    success: false,
                    message: 'Provided object key is invalid after sanitization.'
                }), 400);
            }
        } else {
            const fileExtension = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
            objectKey = `${uuidv4()}${fileExtension}`;
        }

        if (objectKey.length === 0 || objectKey.length > 1024) {
            return c.json(InvalidKeyErrorSchema.parse({ success: false }), 400);
        }

        const contentType = (typeof contentTypeInput === 'string' && contentTypeInput.trim() !== '') ? contentTypeInput.trim() : file.type;
        if (!contentType) {
            return c.json(MissingContentTypeErrorSchema.parse({ success: false }), 400);
        }

        let httpMetadata: R2HTTPMetadata = { contentType };
        let customR2Metadata: Record<string, string> | undefined = undefined;

        if (typeof customMetadataInput === 'string' && customMetadataInput.trim() !== '') {
            try {
                const parsedMeta = JSON.parse(customMetadataInput);
                if (typeof parsedMeta === 'object' && parsedMeta !== null) {
                    customR2Metadata = {};
                    for (const k in parsedMeta) {
                        if (Object.prototype.hasOwnProperty.call(parsedMeta, k)) {
                            customR2Metadata[k] = String(parsedMeta[k]);
                        }
                    }
                } else {
                    throw new Error('Parsed metadata is not an object');
                }
            } catch (e) {
                return c.json(InvalidCustomMetadataErrorSchema.parse({ success: false }), 400);
            }
        }

        await bucket.put(objectKey, file.stream(), {
            httpMetadata,
            customMetadata: customR2Metadata,
        });

        return c.json(UploadObjectSuccessResponseSchema.parse({
            success: true,
            message: 'File uploaded successfully.',
            objectKey: objectKey,
            bucket: logicalBucketName,
            // url: Construct URL if applicable, e.g., if you have a public R2 domain
        }), 201);

    } catch (error: any) {
        console.error('Upload error:', error);
        // Check if it's a Zod validation error from manual parsing (though less likely here)
        if (error instanceof z.ZodError) {
            // This case might be less common here as primary validation is on form data fields directly
            // but kept for robustness if any Zod parsing is added before R2 ops.
            return c.json({
                success: false,
                message: 'Invalid request data due to Zod validation.',
                errors: error.flatten().fieldErrors
            }, 400);
        }
        return c.json(R2OperationErrorSchema.parse({
            success: false,
            message: 'An unexpected error occurred during file upload.',
            details: error.message || 'Unknown R2 operation error.'
        }), 500);
    }
}; 
