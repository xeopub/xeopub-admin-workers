// api-worker/src/handlers/storage/presigned-url-to-head.handler.ts
import { Context } from 'hono';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CloudflareEnv } from '../../env';
import {
    GetPresignedUrlToHeadSuccessResponseSchema,
    BucketNotFoundErrorSchema,
    R2OperationErrorSchema
} from '../../schemas/storage.schemas';

const DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

export const getPresignedUrlToHeadHandler = async (
    c: Context<{ Bindings: CloudflareEnv; Variables: {} }>
) => {
    const logicalBucketName = c.req.query('bucket');
    const key = c.req.query('key');

    if (!logicalBucketName || !key) {
        return c.json({
            message: "Missing required query parameters: 'bucket' and 'key'."
        }, 400);
    }

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

        const command = new HeadObjectCommand({
            Bucket: actualBucketName,
            Key: key,
        });

        const signedUrl = await getSignedUrl(s3Client, command, {
            expiresIn: DEFAULT_PRESIGNED_URL_EXPIRY_SECONDS,
        });

        return c.json(
            GetPresignedUrlToHeadSuccessResponseSchema.parse({
                url: signedUrl,
                method: 'HEAD',
            }),
            200
        );
    } catch (error) {
        console.error(`Error generating S3 presigned URL for key '${key}' in bucket '${actualBucketName}':`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown S3 operation error';
        return c.json(
            R2OperationErrorSchema.parse({
                message: 'Failed to generate S3 presigned URL.',
                details: errorMessage,
            }),
            500
        );
    }
};
