// src/handlers/storage/deleteObject.handler.ts
import type { Handler } from 'hono';
import { z } from 'zod';
import type { CloudflareEnv } from '../../env';
import {
    ObjectPathParamsSchema,
    DeleteObjectSuccessResponseSchema,
    BucketNotFoundErrorSchema,
    ObjectNotFoundErrorSchema, // Can be used if you want to confirm existence before delete, though R2 delete is idempotent
    R2OperationErrorSchema,
    R2BucketNameSchema
} from '../../schemas/storageSchemas';
import { GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas';
import { getR2Bucket } from './utils'; // Import from shared utils

export const deleteObjectHandler: Handler<{
    Bindings: CloudflareEnv;
    Variables: {};
}> = async (c) => {
    try {
        const { logicalBucketName, objectKey } = c.req.param() as z.infer<typeof ObjectPathParamsSchema>;

        const parsedParams = ObjectPathParamsSchema.safeParse({ logicalBucketName, objectKey });
        if (!parsedParams.success) {
            return c.json(GeneralBadRequestErrorSchema.parse({
                success: false,
                message: 'Invalid path parameters.',
                // errors: parsedParams.error.flatten().fieldErrors
            }), 400);
        }

        const bucket = getR2Bucket(c, parsedParams.data.logicalBucketName);
        if (!bucket) {
            return c.json(BucketNotFoundErrorSchema.parse({
                success: false,
                message: 'The specified bucket binding was not found or is not configured.',
                bucketNameAttempted: parsedParams.data.logicalBucketName
            }), 500);
        }

        // R2 delete is idempotent; it doesn't error if the object doesn't exist.
        // If you need to confirm existence first, you could do a `head()` or `get()` call,
        // but that adds latency and cost. For a simple delete, just calling delete is often sufficient.
        await bucket.delete(parsedParams.data.objectKey);

        return c.json(DeleteObjectSuccessResponseSchema.parse({
            success: true,
            message: 'Object deleted successfully.',
            objectKey: parsedParams.data.objectKey,
            bucket: parsedParams.data.logicalBucketName
        }), 200);

    } catch (error: any) {
        console.error('Delete error:', error);
        if (error instanceof z.ZodError) {
            return c.json(GeneralBadRequestErrorSchema.parse({
               success: false,
               message: 'Invalid request data due to Zod validation.',
               // errors: error.flatten().fieldErrors
           }), 400);
       }
        return c.json(R2OperationErrorSchema.parse({
            success: false,
            message: 'An unexpected error occurred while attempting to delete the object.',
            details: error.message || 'Unknown R2 operation error.'
        }), 500);
    }
}; 
