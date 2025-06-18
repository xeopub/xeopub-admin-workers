// src/routes/posts.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  PostCreateRequestSchema,
  PostCreateResponseSchema,
  ListPostsResponseSchema,
  GetPostResponseSchema,
  PostUpdateRequestSchema,
  PostUpdateResponseSchema,
  PostDeleteResponseSchema,
  PostCreateFailedErrorSchema,
  PostNotFoundErrorSchema,
  PostUpdateFailedErrorSchema,
  PostDeleteFailedErrorSchema,
  PostSchema, // For placeholder data
  PostStatusSchema,
  PostPublicationTypeSchema,
} from '../schemas/postSchemas';
import {
  PathIdParamSchema,
  GeneralServerErrorSchema,
  GeneralBadRequestErrorSchema
} from '../schemas/commonSchemas';
import { createPostHandler } from '../handlers/posts/createPost.handler';
import { listPostsHandler } from '../handlers/posts/listPosts.handler';
import { getPostByIdHandler } from '../handlers/posts/getPostById.handler';
import { updatePostHandler } from '../handlers/posts/updatePost.handler';
import { deletePostHandler } from '../handlers/posts/deletePost.handler';

const postRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>();

// POST /posts
const createPostRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: PostCreateRequestSchema } },
      description: 'Data for the new post.',
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PostCreateResponseSchema } },
      description: 'Post created successfully.',
    },
    400: {
      content: { 'application/json': { schema: PostCreateFailedErrorSchema } },
      description: 'Invalid input (e.g., validation errors, invalid website/series ID).',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Creates a new post.',
  description: 'Creates a new post with the provided details. Status defaults to "draft" if not specified.',
  tags: ['Posts'],
});

postRoutes.openapi(createPostRouteDef, createPostHandler);

// GET /posts
const listPostsRouteDef = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ example: '1', description: 'Page number for pagination.' }),
      limit: z.string().optional().openapi({ example: '10', description: 'Number of items per page.' }),
      status: PostStatusSchema.optional().openapi({ description: 'Filter by post status.' }),
      website_id: z.string().optional().openapi({ description: 'Filter by website ID.' }), // Assuming string for ID from query
      series_id: z.string().optional().openapi({ description: 'Filter by series ID.' }), // Assuming string for ID from query
      title: z.string().optional().openapi({ description: 'Filter by post title (case-insensitive, partial match).' }),
      type: PostPublicationTypeSchema.optional().openapi({ description: "Filter by post publication type (e.g., 'evergreen', 'news')." }),
    }).openapi('ListPostsQuery'),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListPostsResponseSchema } },
      description: 'A list of posts.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Lists all posts.',
  description: 'Retrieves a list of all posts. Supports pagination and filtering.',
  tags: ['Posts'],
});

postRoutes.openapi(listPostsRouteDef, listPostsHandler);

// GET /posts/{id}
const getPostByIdRouteDef = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GetPostResponseSchema } },
      description: 'Details of the post.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request.',
    },
    404: {
      content: { 'application/json': { schema: PostNotFoundErrorSchema } },
      description: 'Post not found.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Gets a specific post by its ID.',
  tags: ['Posts'],
});

postRoutes.openapi(getPostByIdRouteDef, getPostByIdHandler);

// PUT /posts/{id}
const updatePostRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
    body: {
      content: { 'application/json': { schema: PostUpdateRequestSchema } },
      description: 'Data to update for the post.',
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PostUpdateResponseSchema } },
      description: 'Post updated successfully.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Invalid input (e.g., validation errors, invalid website/series ID).',
    },
    404: {
      content: { 'application/json': { schema: PostNotFoundErrorSchema } }, 
      description: 'Post not found or no changes made.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Updates an existing post.',
  tags: ['Posts'],
});

postRoutes.openapi(updatePostRouteDef, updatePostHandler);

// DELETE /posts/{id}
const deletePostRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PostDeleteResponseSchema } },
      description: 'Post deleted successfully.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request or deletion failed due to constraints.',
    },
    404: {
      content: { 'application/json': { schema: PostNotFoundErrorSchema } },
      description: 'Post not found.',
    },
    500: { 
      content: { 'application/json': { schema: GeneralServerErrorSchema } }, 
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Deletes a post.',
  tags: ['Posts'],
});

postRoutes.openapi(deletePostRouteDef, deletePostHandler);

export default postRoutes;
