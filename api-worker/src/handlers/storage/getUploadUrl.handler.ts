// api-worker/src/handlers/storage/getUploadUrl.handler.ts
import { Context } from 'hono';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudflareEnv } from '../../env'; // Adjusted path
import {
    GetUploadUrlRequestSchema, // Will be used by the router, not directly here for c.req.json()
    GetUploadUrlSuccessResponseSchema,
    BucketNotFoundErrorSchema,
    R2OperationErrorSchema // Can be repurposed or replaced with a generic S3 error schema
} from '../../schemas/storageSchemas';
import { z } from 'zod'; // For schema parsing if needed, though request body is now just c.req.json()

const DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export const getUploadUrlHandler = async (
    c: Context<{ Bindings: CloudflareEnv; Variables: {} }>
) => {
    const { bucket: logicalBucketName, key, contentType } = await c.req.json();

    let actualBucketName: string | undefined;

    if (logicalBucketName === 'POST_PROJECTS_BUCKET') {
        actualBucketName = c.env.POST_PROJECTS_BUCKET_NAME;
    } else if (logicalBucketName === 'DEFAULT_FILES_BUCKET') {
        actualBucketName = c.env.DEFAULT_FILES_BUCKET_NAME;
    }

    if (!actualBucketName) {
        console.error(`Actual bucket name mapping not found for logical name: ${logicalBucketName}`);
        return c.json(
            BucketNotFoundErrorSchema.parse({
                message: `The specified logical bucket name '${logicalBucketName}' is not configured for S3 presigned URL generation.`,
                bucketNameAttempted: logicalBucketName,
            }),
            404
        );
    }

    try {
        const s3Client = new S3Client({
            endpoint: c.env.R2_S3_ENDPOINT,
            region: c.env.R2_REGION,
            credentials: {
                accessKeyId: c.env.R2_ACCESS_KEY_ID,
                secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
            },
        });

        const commandParams: any = {
            Bucket: actualBucketName,
            Key: key,
        };

        if (contentType) {
            commandParams.ContentType = contentType;
        }
        // Note: For custom metadata with presigned PUT URLs, the client must send x-amz-meta-* headers.
        // The `Metadata` field in PutObjectCommand is for server-side metadata storage.

        const command = new PutObjectCommand(commandParams);

        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS,
        });

        return c.json(
            GetUploadUrlSuccessResponseSchema.parse({
                url: signedUrl,
                method: 'PUT',
            }),
            200
        );
    } catch (error) {
        console.error(`Error generating S3 presigned URL for key '${key}' in bucket '${actualBucketName}':`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown S3 operation error';
        return c.json(
            R2OperationErrorSchema.parse({ // Consider a more generic S3 error schema if needed
                message: 'Failed to generate S3 presigned URL.',
                details: errorMessage,
            }),
            500
        );
    }
};
