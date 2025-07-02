// src/routes/series.ts
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  SeriesCreateRequestSchema,
  SeriesCreateResponseSchema,
  ListSeriesResponseSchema,
  GetSeriesResponseSchema,
  SeriesUpdateRequestSchema,
  SeriesUpdateResponseSchema,
  SeriesDeleteResponseSchema,
  SeriesCreateFailedErrorSchema,
  SeriesNotFoundErrorSchema,
  SeriesUpdateFailedErrorSchema,
  SeriesDeleteFailedErrorSchema,
  ListSeriesQuerySchema // Added import for the query schema
} from '../schemas/series.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../schemas/common.schemas';
import { createSeriesHandler } from '../handlers/series/create-series.handler';
import { listSeriesHandler } from '../handlers/series/list-series.handler';
import { getSeriesByIdHandler } from '../handlers/series/get-series-by-id.handler';
import { updateSeriesHandler } from '../handlers/series/update-series.handler';
import { deleteSeriesHandler } from '../handlers/series/delete-series.handler';

const seriesRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>();

// POST /series - Create Series
const createSeriesRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: SeriesCreateRequestSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: SeriesCreateResponseSchema } }, description: 'Series created' },
    400: { content: { 'application/json': { schema: SeriesCreateFailedErrorSchema } }, description: 'Invalid input' }, // Can be more specific, e.g. title exists in website
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Creates a new series.',
  tags: ['Series'],
});
seriesRoutes.openapi(createSeriesRouteDef, createSeriesHandler);

// GET /series - List Series
const listSeriesRouteDef = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: ListSeriesQuerySchema, // Use the imported schema
  },
  responses: {
    200: { content: { 'application/json': { schema: ListSeriesResponseSchema } }, description: 'A paginated list of series.' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Bad request (e.g., invalid query parameters).' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Lists all series with pagination and filtering.',
  description: 'Retrieves a list of series. Supports pagination, filtering by title (case-insensitive, partial match), and filtering by website ID.',
  tags: ['Series'],
});
seriesRoutes.openapi(listSeriesRouteDef, listSeriesHandler);

// GET /series/{id} - Get Series by ID
const getSeriesByIdRouteDef = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: GetSeriesResponseSchema } }, description: 'Series details' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: SeriesNotFoundErrorSchema } }, description: 'Series not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Gets a series by ID.',
  tags: ['Series'],
});
seriesRoutes.openapi(getSeriesByIdRouteDef, getSeriesByIdHandler);

// PUT /series/{id} - Update Series
const updateSeriesRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
    body: { content: { 'application/json': { schema: SeriesUpdateRequestSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: SeriesUpdateResponseSchema } }, description: 'Series updated' },
    400: { content: { 'application/json': { schema: SeriesUpdateFailedErrorSchema } }, description: 'Invalid input' },
    404: { content: { 'application/json': { schema: SeriesNotFoundErrorSchema } }, description: 'Series not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Updates an existing series.',
  tags: ['Series'],
});
seriesRoutes.openapi(updateSeriesRouteDef, updateSeriesHandler);

// DELETE /series/{id} - Delete Series
const deleteSeriesRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: SeriesDeleteResponseSchema } }, description: 'Series deleted' },
    400: { content: { 'application/json': { schema: SeriesDeleteFailedErrorSchema } }, description: 'Deletion failed (e.g., series has posts)' },
    404: { content: { 'application/json': { schema: SeriesNotFoundErrorSchema } }, description: 'Series not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Deletes a series.',
  tags: ['Series'],
});
seriesRoutes.openapi(deleteSeriesRouteDef, deleteSeriesHandler);

export default seriesRoutes;
