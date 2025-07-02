// src/schemas/series.schemas.ts
import { z } from '@hono/zod-openapi';
import {
  MessageResponseSchema,
  GeneralBadRequestErrorSchema,
  GeneralNotFoundErrorSchema,
} from './common.schemas';

// Base schema for series properties
const SeriesBaseSchema = z.object({
  title: z.string().min(1).max(255)
    .openapi({ example: 'My Awesome Post Series', description: 'The title of the series.' }),
  slug: z.string().max(255).optional().openapi({ example: 'my-awesome-post-series', description: 'The URL-friendly slug for the series. Auto-generated if not provided.' }),
  description: z.string().max(5000).optional()
    .openapi({ example: 'A series about interesting topics.', description: 'A detailed description of the series.' }),
  websiteId: z.number().int().positive()
    .openapi({ example: 1, description: 'The ID of the website this series belongs to.' })
}).openapi('SeriesBase');

// Full Series schema for API responses
export const SeriesSchema = SeriesBaseSchema.omit({ slug: true }).extend({
  slug: z.string().max(255).openapi({ example: 'my-awesome-post-series', description: 'The URL-friendly slug for the series.' }), // Made non-optional for responses
  id: z.number().int().positive().openapi({ example: 1, description: 'Unique identifier for the series.' }),
  createdAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the series was created.' }),
  updatedAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the series was last updated.' }),
  // Note: 'slug' was previously inherited as optional from SeriesBaseSchema.
  // It's now explicitly non-optional here, as a retrieved series should always have a slug.
}).openapi('Series');

// Schema for creating a new series
export const SeriesCreateRequestSchema = SeriesBaseSchema;

export const SeriesCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Series created successfully.'),
  id: z.number().int().positive().openapi({ example: 101 }),
}).openapi('SeriesCreateResponse');

// Schema for the summary of a series, used in lists
export const SeriesSummarySchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  title: z.string().openapi({ example: 'My Awesome Post Series' }),
  slug: z.string().max(255).openapi({ example: 'my-awesome-post-series' }),
  websiteId: z.number().int().positive().openapi({ example: 1 })
}).openapi('SeriesSummary');

// Schema for pagination details
const PaginationSchema = z.object({
  page: z.number().int().positive().openapi({ example: 1, description: 'Current page number.' }),
  limit: z.number().int().positive().openapi({ example: 10, description: 'Number of items per page.' }),
  totalItems: z.number().int().nonnegative().openapi({ example: 100, description: 'Total number of items available.' }),
  totalPages: z.number().int().nonnegative().openapi({ example: 10, description: 'Total number of pages.' }),
}).openapi('Pagination');

// Enum for sortable fields for Series
export const SeriesSortBySchema = z.enum([
  'id',
  'title',
  'websiteId',
  'createdAt',
  'updatedAt'
]).openapi({ description: 'Field to sort series by.', example: 'title' });

// Enum for sort order
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi({ description: 'Sort order.', example: 'asc' });

// Schema for query parameters for listing series
export const ListSeriesQuerySchema = z.object({
    page: z.string().optional().default('1').transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'Page must be positive' }),
    limit: z.string().optional().default('10').transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'Limit must be positive' }),
    title: z.string().optional().openapi({ description: 'Filter by series title (case-insensitive, partial match).' }),
    websiteId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || val > 0, { message: 'Website ID must be positive' }),
    sortBy: SeriesSortBySchema.optional().default('title')
      .openapi({ description: 'Field to sort series by.', example: 'title' }),
    sortOrder: SortOrderSchema.optional().default('asc')
      .openapi({ description: 'Sort order (asc/desc).', example: 'asc' }),
  });

// Schema for listing series
export const ListSeriesResponseSchema = z.object({
  series: z.array(SeriesSummarySchema), // Using SeriesSummarySchema for lists
  pagination: PaginationSchema
}).openapi('ListSeriesResponse');

// Schema for getting a single series
export const GetSeriesResponseSchema = z.object({
  series: SeriesSchema
}).openapi('GetSeriesResponse');

// Schema for updating a series
// For PUT, typically all optional fields from base can be updated.
// If youtube_playlist_id is meant to be cleared, sending null is appropriate.
export const SeriesUpdateRequestSchema = SeriesBaseSchema.partial().openapi('SeriesUpdateRequest');

export const SeriesUpdateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Series updated successfully.')
}).openapi('SeriesUpdateResponse');

// Schema for deleting a series
export const SeriesDeleteResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Series deleted successfully.')
}).openapi('SeriesDeleteResponse');

// --- Specific Error Schemas for Series ---
export const SeriesCreateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to create series.' })
  // Add specific field errors if needed, e.g., title_exists_in_website
}).openapi('SeriesCreateFailedError');

export const SeriesSlugExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.literal("Series slug already exists in this website.")
}).openapi('SeriesSlugExistsError');

export const SeriesUpdateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to update series.' })
}).openapi('SeriesUpdateFailedError');

export const SeriesDeleteFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Cannot delete series: It has associated posts.' })
}).openapi('SeriesDeleteFailedError');

export const SeriesNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
  message: z.string().openapi({ example: 'Series not found.' })
}).openapi('SeriesNotFoundError');
