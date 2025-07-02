// src/handlers/storage/utils.ts
import { z } from 'zod';
import { R2BucketNameSchema } from '../../schemas/storage.schemas';
// Assuming R2Bucket type is globally available or defined in a .d.ts file

export function getR2Bucket(c: any, logicalBucketName: z.infer<typeof R2BucketNameSchema>): R2Bucket | null {
    switch (logicalBucketName) {
        case 'POST_PROJECTS_BUCKET':
            return c.env.POST_PROJECTS_BUCKET;
        case 'DEFAULT_FILES_BUCKET':
            return c.env.DEFAULT_FILES_BUCKET;
        default:
            // Optionally, log an error or throw if the name is unrecognized and shouldn't be
            console.error(`Unrecognized R2 bucket logical name: ${logicalBucketName}`);
            return null;
    }
}

// Add other shared utility functions for storage handlers here if needed
