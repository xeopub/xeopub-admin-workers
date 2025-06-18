// src/schemas/seriesSchemas.ts
import { z } from '@hono/zod-openapi';
import {
  MessageResponseSchema,
  GeneralBadRequestErrorSchema,
  GeneralNotFoundErrorSchema,
  GeneralServerErrorSchema
} from './commonSchemas';

// Base schema for series properties
const SeriesBaseSchema = z.object({
  title: z.string().min(1).max(255)
    .openapi({ example: 'My Awesome Post Series', description: 'The title of the series.' }),
  slug: z.string().max(255).optional().openapi({ example: 'my-awesome-post-series', description: 'The URL-friendly slug for the series. Auto-generated if not provided.' }),
  description: z.string().max(5000).optional()
    .openapi({ example: 'A series about interesting topics.', description: 'A detailed description of the series.' }),
  website_id: z.number().int().positive()
    .openapi({ example: 1, description: 'The ID of the website this series belongs to.' })
}).openapi('SeriesBase');

// Full Series schema for API responses
export const SeriesSchema = SeriesBaseSchema.omit({ slug: true }).extend({
  slug: z.string().max(255).openapi({ example: 'my-awesome-post-series', description: 'The URL-friendly slug for the series.' }), // Made non-optional for responses
  id: z.number().int().positive().openapi({ example: 1, description: 'Unique identifier for the series.' }),
  created_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the series was created.' }),
  updated_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the series was last updated.' }),
  // Note: 'slug' was previously inherited as optional from SeriesBaseSchema.
  // It's now explicitly non-optional here, as a retrieved series should always have a slug.
}).openapi('Series');

// Schema for creating a new series
export const SeriesCreateRequestSchema = SeriesBaseSchema;

export const SeriesCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Series created successfully.'),
  seriesId: z.number().int().positive().openapi({ example: 101 }),
}).openapi('SeriesCreateResponse');

// Schema for the summary of a series, used in lists
export const SeriesSummarySchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  title: z.string().openapi({ example: 'My Awesome Post Series' }),
  slug: z.string().max(255).openapi({ example: 'my-awesome-post-series' }),
  website_id: z.number().int().positive().openapi({ example: 1 })
}).openapi('SeriesSummary');

// Schema for listing series
export const ListSeriesResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  series: z.array(SeriesSummarySchema) // Using SeriesSummarySchema for lists
}).openapi('ListSeriesResponse');

// Schema for getting a single series
export const GetSeriesResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
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
