// src/routes/websites.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  WebsiteCreateRequestSchema,
  WebsiteCreateResponseSchema,
  ListWebsitesQuerySchema, // Added
  ListWebsitesResponseSchema,
  GetWebsiteResponseSchema,
  WebsiteUpdateRequestSchema,
  WebsiteUpdateResponseSchema,
  WebsiteDeleteResponseSchema,
  WebsiteNameExistsErrorSchema,
  WebsiteCreateFailedErrorSchema,
  WebsiteNotFoundErrorSchema,
  WebsiteUpdateFailedErrorSchema,
  WebsiteDeleteFailedErrorSchema
} from '../schemas/website.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../schemas/common.schemas';
import { createWebsiteHandler } from '../handlers/websites/create-website.handler';
import { listWebsitesHandler } from '../handlers/websites/list-websites.handler';
import { getWebsiteByIdHandler } from '../handlers/websites/get-website-by-id.handler';
import { updateWebsiteHandler } from '../handlers/websites/update-website.handler';
import { deleteWebsiteHandler } from '../handlers/websites/delete-website.handler';

const websiteRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>(); // Typed with CloudflareEnv

// POST /websites
const createWebsiteRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: WebsiteCreateRequestSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: WebsiteCreateResponseSchema } }, description: 'Website created' },
    400: { content: { 'application/json': { schema: z.union([WebsiteNameExistsErrorSchema, WebsiteCreateFailedErrorSchema]) } }, description: 'Invalid input' },
    500: { content: { 'application/json': { schema: WebsiteCreateFailedErrorSchema } }, description: 'Server error' },
  },
  summary: 'Creates a new website.', tags: ['Websites'],
});
websiteRoutes.openapi(createWebsiteRouteDef, createWebsiteHandler);

// GET /websites
const listWebsitesRouteDef = createRoute({
  method: 'get', path: '/',
  request: {
    query: ListWebsitesQuerySchema,
  },
  responses: {
    200: { content: { 'application/json': { schema: ListWebsitesResponseSchema } }, description: 'List of websites' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Invalid query parameters' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Lists all websites.', 
  description: 'Retrieves a list of all websites. Supports pagination and filtering by name and language code.',
  tags: ['Websites'],
});
websiteRoutes.openapi(listWebsitesRouteDef, listWebsitesHandler);

// GET /websites/{id}
const getWebsiteByIdRouteDef = createRoute({
  method: 'get', path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: GetWebsiteResponseSchema } }, description: 'Website details' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Invalid request' }, // Added GeneralBadRequestErrorSchema
    404: { content: { 'application/json': { schema: WebsiteNotFoundErrorSchema } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Gets a website by ID.', tags: ['Websites'],
});
websiteRoutes.openapi(getWebsiteByIdRouteDef, getWebsiteByIdHandler);

// PUT /websites/{id}
const updateWebsiteRouteDef = createRoute({
  method: 'put', path: '/{id}',
  request: {
    params: PathIdParamSchema,
    body: { content: { 'application/json': { schema: WebsiteUpdateRequestSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: WebsiteUpdateResponseSchema } }, description: 'Website updated' },
    400: { content: { 'application/json': { schema: z.union([WebsiteNameExistsErrorSchema, WebsiteUpdateFailedErrorSchema, GeneralBadRequestErrorSchema]) } }, description: 'Invalid input' }, // Added GeneralBadRequestErrorSchema
    404: { content: { 'application/json': { schema: WebsiteNotFoundErrorSchema } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: WebsiteUpdateFailedErrorSchema } }, description: 'Server error' },
  },
  summary: 'Updates a website.', tags: ['Websites'],
});
websiteRoutes.openapi(updateWebsiteRouteDef, updateWebsiteHandler);

// DELETE /websites/{id}
const deleteWebsiteRouteDef = createRoute({
  method: 'delete', path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: WebsiteDeleteResponseSchema } }, description: 'Website deleted' },
    400: { content: { 'application/json': { schema: WebsiteDeleteFailedErrorSchema } }, description: 'Deletion failed (e.g. constraints)' },
    404: { content: { 'application/json': { schema: WebsiteNotFoundErrorSchema } }, description: 'Not found' },
    500: { content: { 'application/json': { schema: WebsiteDeleteFailedErrorSchema } }, description: 'Server error' },
  },
  summary: 'Deletes a website.', tags: ['Websites'],
});
websiteRoutes.openapi(deleteWebsiteRouteDef, deleteWebsiteHandler);

export default websiteRoutes;
