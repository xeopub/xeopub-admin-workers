// src/routes/storage.ts

import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';

// Handlers

import { getPresignedUrlToUploadHandler } from '../handlers/storage/presigned-url-to-upload.handler';
import { getPresignedUrlToDownloadHandler } from '../handlers/storage/presigned-url-to-download.handler';
import { getPresignedUrlToDeleteHandler } from '../handlers/storage/presigned-url-to-delete.handler';
import { getPresignedUrlToHeadHandler } from '../handlers/storage/presigned-url-to-head.handler';

// Schemas
import {
    BucketNotFoundErrorSchema,
    R2OperationErrorSchema,
    GetPresignedUrlToUploadRequestSchema,
    GetPresignedUrlToUploadSuccessResponseSchema,
    GetPresignedUrlToDownloadRequestSchema,
    GetPresignedUrlToDownloadSuccessResponseSchema,
    GetPresignedUrlToDeleteRequestSchema,
    GetPresignedUrlToDeleteSuccessResponseSchema,
    GetPresignedUrlToHeadRequestSchema,
    GetPresignedUrlToHeadSuccessResponseSchema
} from '../schemas/storage.schemas';
import {
    GeneralBadRequestErrorSchema,
} from '../schemas/common.schemas';

const storageRoutes = new OpenAPIHono<{
    Bindings: CloudflareEnv;
    Variables: {};
}>();



// --- Get Upload URL Route ---
const getPresignedUrlToUploadRoute = createRoute({
    method: 'get',
    path: '/presigned-url-to-upload',
    request: {
        query: GetPresignedUrlToUploadRequestSchema,
    },
    responses: {
        200: {
            description: 'Successfully generated presigned URL for upload.',
            content: {
                'application/json': {
                    schema: GetPresignedUrlToUploadSuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Bad Request - Invalid input or missing query parameters.',
            content: {
                'application/json': {
                    schema: GeneralBadRequestErrorSchema, // For Zod validation errors
                },
            },
        },
        404: {
            description: 'Bucket Not Found - The specified bucket binding was not found.',
            content: {
                'application/json': {
                    schema: BucketNotFoundErrorSchema,
                },
            },
        },
        500: {
            description: 'Server Error - Failed to generate presigned URL.',
            content: {
                'application/json': {
                    schema: R2OperationErrorSchema,
                },
            },
        },
    },
    summary: 'Get a presigned URL for uploading an object to R2.',
    description: 'Requests a presigned URL that can be used to PUT an object directly into a specified R2 bucket and key. The URL has a limited validity period.',
    tags: ['Storage'],
});

storageRoutes.openapi(getPresignedUrlToUploadRoute, getPresignedUrlToUploadHandler);

// --- Get Presigned URL to Download Route ---
const getPresignedUrlToDownloadRoute = createRoute({
    method: 'get',
    path: '/presigned-url-to-download',
    request: {
        query: GetPresignedUrlToDownloadRequestSchema,
    },
    responses: {
        200: {
            description: 'Successfully generated presigned URL for download.',
            content: {
                'application/json': {
                    schema: GetPresignedUrlToDownloadSuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Bad Request - Invalid input or missing query parameters.',
            content: {
                'application/json': {
                    schema: GeneralBadRequestErrorSchema,
                },
            },
        },
        404: {
            description: 'Bucket Not Found - The specified bucket binding was not found.',
            content: {
                'application/json': {
                    schema: BucketNotFoundErrorSchema,
                },
            },
        },
        500: {
            description: 'Server Error - Failed to generate presigned URL.',
            content: {
                'application/json': {
                    schema: R2OperationErrorSchema,
                },
            },
        },
    },
    summary: 'Get a presigned URL for downloading an object from R2.',
    description: 'Requests a presigned URL that can be used to GET an object directly from a specified R2 bucket and key. The URL has a limited validity period.',
    tags: ['Storage'],
});

storageRoutes.openapi(getPresignedUrlToDownloadRoute, getPresignedUrlToDownloadHandler);

// --- Get Presigned URL to Delete Route ---
const getPresignedUrlToDeleteRoute = createRoute({
    method: 'get',
    path: '/presigned-url-to-delete',
    request: {
        query: GetPresignedUrlToDeleteRequestSchema,
    },
    responses: {
        200: {
            description: 'Successfully generated presigned URL for deletion.',
            content: {
                'application/json': {
                    schema: GetPresignedUrlToDeleteSuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Bad Request - Invalid input or missing query parameters.',
            content: {
                'application/json': {
                    schema: GeneralBadRequestErrorSchema,
                },
            },
        },
        404: {
            description: 'Bucket Not Found - The specified bucket binding was not found.',
            content: {
                'application/json': {
                    schema: BucketNotFoundErrorSchema,
                },
            },
        },
        500: {
            description: 'Server Error - Failed to generate presigned URL.',
            content: {
                'application/json': {
                    schema: R2OperationErrorSchema,
                },
            },
        },
    },
    summary: 'Get a presigned URL for deleting an object from R2.',
    description: 'Requests a presigned URL that can be used to DELETE an object directly from a specified R2 bucket and key. The URL has a limited validity period.',
    tags: ['Storage'],
});

storageRoutes.openapi(getPresignedUrlToDeleteRoute, getPresignedUrlToDeleteHandler);

// --- Get Presigned URL to Head Route ---
const getPresignedUrlToHeadRoute = createRoute({
    method: 'get',
    path: '/presigned-url-to-head',
    request: {
        query: GetPresignedUrlToHeadRequestSchema,
    },
    responses: {
        200: {
            description: 'Successfully generated presigned URL for head operation.',
            content: {
                'application/json': {
                    schema: GetPresignedUrlToHeadSuccessResponseSchema,
                },
            },
        },
        400: {
            description: 'Bad Request - Invalid input or missing query parameters.',
            content: {
                'application/json': {
                    schema: GeneralBadRequestErrorSchema,
                },
            },
        },
        404: {
            description: 'Bucket Not Found - The specified bucket binding was not found.',
            content: {
                'application/json': {
                    schema: BucketNotFoundErrorSchema,
                },
            },
        },
        500: {
            description: 'Server Error - Failed to generate presigned URL.',
            content: {
                'application/json': {
                    schema: R2OperationErrorSchema,
                },
            },
        },
    },
    summary: 'Get a presigned URL for performing a head operation on an object in R2.',
    description: 'Requests a presigned URL that can be used to HEAD an object directly from a specified R2 bucket and key. The URL has a limited validity period.',
    tags: ['Storage'],
});

storageRoutes.openapi(getPresignedUrlToHeadRoute, getPresignedUrlToHeadHandler);

export default storageRoutes;
