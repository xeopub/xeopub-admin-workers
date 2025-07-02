// src/schemas/commonSchemas.ts
import { z } from '@hono/zod-openapi';

// Schema for pagination information in responses
export const PaginationInfoSchema = z.object({
  page: z.number().int().positive().openapi({ example: 1, description: 'Current page number.' }),
  limit: z.number().int().positive().openapi({ example: 10, description: 'Number of items per page.' }),
  totalItems: z.number().int().nonnegative().openapi({ example: 100, description: 'Total number of items.' }),
  totalPages: z.number().int().nonnegative().openapi({ example: 10, description: 'Total number of pages.' }),
}).openapi('PaginationInfo');

// Schema for pagination query parameters in requests
export const PaginationQuerySchema = z.object({
  page: z.string().optional().default('1')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive().openapi({ description: 'Page number for pagination (default: 1).', example: 1 })),
  limit: z.string().optional().default('10')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100).openapi({ description: 'Number of items per page (default: 10, max: 100).', example: 10 })),
}).openapi('PaginationQuery');


export const ErrorSchema = z.object({
  error: z.string().optional().openapi({ example: 'error_code' }),
  message: z.string().openapi({ example: 'A detailed error message.' }),
}).openapi('ErrorResponse');


export const SuccessSchema = z.object({
  message: z.string().optional().openapi({ example: 'Operation successful.' }),
}).openapi('SuccessResponse');

export const MessageResponseSchema = z.object({
    message: z.string().openapi({example: "Action completed successfully."})
}).openapi('MessageResponse');

// Generic function to create a paginated response schema
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T, keyName: string) =>
  z.object({
    [keyName]: z.array(itemSchema),
    pagination: PaginationInfoSchema, // Added pagination info object
  });
  // Note: When using this generic to define a concrete schema, apply .openapi('...' }) to the result.
  // e.g., export const PaginatedCustomItemsResponse = PaginatedResponseSchema(CustomItemSchema, 'items').openapi('PaginatedCustomItemsResponse');

// Generic function to create a simple list response schema
export const SimpleListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T, keyName: string) =>
  z.object({
    [keyName]: z.array(itemSchema),
  });

export const PathIdParamSchema = z.object({
  id: z
    .string()
    .openapi({
      param: {
        name: 'id',
        in: 'path',
        required: true, // As per common practice for path params
      },
      example: '123',
      description: 'The unique identifier (can be integer string or UUID string).',
    }),
});

export const GeneralBadRequestErrorSchema = ErrorSchema.extend({
    message: z.string().openapi({ example: 'Invalid input.' })
}).openapi('GeneralBadRequestError');

export const GeneralNotFoundErrorSchema = ErrorSchema.extend({
    message: z.string().openapi({ example: 'Resource not found.' })
}).openapi('GeneralNotFoundError');

export const GeneralServerErrorSchema = ErrorSchema.extend({
    message: z.string().openapi({ example: 'An internal server error occurred.' })
}).openapi('GeneralServerError');

export const GeneralConflictErrorSchema = ErrorSchema.extend({
    message: z.string().openapi({ example: 'A conflict occurred.' })
}).openapi('GeneralConflictError');

export const GeneralUnauthorizedErrorSchema = ErrorSchema.extend({
  error: z.literal('unauthorized').optional(),
  message: z.string().openapi({example: 'Unauthorized access.'})
}).openapi('GeneralUnauthorizedError');
