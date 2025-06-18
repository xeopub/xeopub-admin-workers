// src/handlers/storage/downloadObject.handler.ts
import type { Handler } from 'hono';
import { z } from 'zod';
import type { CloudflareEnv } from '../../env';
import {
    ObjectPathParamsSchema, // Already includes R2BucketNameSchema
    BucketNotFoundErrorSchema,
    ObjectNotFoundErrorSchema,
    R2OperationErrorSchema,
    R2BucketNameSchema // For direct use in getR2Bucket
} from '../../schemas/storageSchemas';
import { GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas';
import { getR2Bucket } from './utils'; // Import from shared utils

export const downloadObjectHandler: Handler<{
    Bindings: CloudflareEnv;
    Variables: {};
    // Path parameters are validated by the routing layer if zValidator is used in routes.ts
    // Or, we can parse them explicitly here if needed, but typically route validation is cleaner.
}> = async (c) => {
    try {
        const { logicalBucketName, objectKey } = c.req.param() as z.infer<typeof ObjectPathParamsSchema>;

        // Validate params again if not using zValidator in route, or for extra safety
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

        const object = await bucket.get(parsedParams.data.objectKey);

        if (object === null) {
            return c.json(ObjectNotFoundErrorSchema.parse({
                success: false,
                message: 'The requested object was not found in the specified bucket.',
                objectKeyAttempted: parsedParams.data.objectKey,
                bucketQueried: parsedParams.data.logicalBucketName
            }), 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        // Ensure 'etag' is enclosed in quotes if it's not already (common for HTTP ETags)
        const etag = headers.get('etag');
        if (etag && !etag.startsWith('"') && !etag.endsWith('"')) {
            headers.set('etag', `"${etag}"`);
        }
        // headers.set('Content-Disposition', `attachment; filename="${parsedParams.data.objectKey.split('/').pop() || 'download'}"`);
        // For inline display, Content-Disposition is often not needed or should be 'inline'
        // The browser will decide based on Content-Type primarily.

        // Add cache control headers if desired, e.g., public, max-age=3600
        // headers.set('Cache-Control', 'public, max-age=3600');

        return new Response(object.body, {
            headers,
            status: 200 // OK
        });

    } catch (error: any) {
        console.error('Download error:', error);
        if (error instanceof z.ZodError) {
             return c.json(GeneralBadRequestErrorSchema.parse({
                success: false,
                message: 'Invalid request data due to Zod validation.',
                // errors: error.flatten().fieldErrors
            }), 400);
        }
        return c.json(R2OperationErrorSchema.parse({
            success: false,
            message: 'An unexpected error occurred while attempting to download the object.',
            details: error.message || 'Unknown R2 operation error.'
        }), 500);
    }
}; 
