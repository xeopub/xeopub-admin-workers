// src/schemas/websiteSchemas.ts
import { z } from '@hono/zod-openapi';
import { 
    MessageResponseSchema, 
    GeneralBadRequestErrorSchema, 
    GeneralNotFoundErrorSchema,
  PaginationInfoSchema
} from './common.schemas';

const WebsiteBaseSchema = z.object({
  name: z.string().max(255).openapi({ example: 'Technology Updates' }),
  slug: z.string().max(255).optional().openapi({ example: 'technology-updates', description: 'The URL-friendly slug for the website. Auto-generated if not provided.' }),
  description: z.string().max(5000).openapi({ example: 'Latest news and discussions in the tech world.' }),
  slogan: z.string().max(500).openapi({ example: 'Your daily dose of tech insights.' }),
  customUrl: z.string().max(255).openapi({ example: 'tech-unfiltered-website' }),
  defaultPostBackgroundBucketKey: z.string().openapi({ example: 'defaults/website_post_bg.mp4' }),
  defaultPostThumbnailBucketKey: z.string().openapi({ example: 'defaults/website_post_thumb.png' }),
  defaultPostBackgroundMusicBucketKey: z.string().openapi({ example: 'defaults/website_music_bg.mp3' }),
  defaultPostIntroMusicBucketKey: z.string().openapi({ example: 'defaults/website_music_intro.mp3' }),
  firstCommentTemplate: z.string().openapi({ example: 'Check out our latest website post on {topic}!' }),
  promptTemplateToGenEvergreenTitles: z.string().openapi({ example: 'Generate an evergreen title about {topic} for this website.' }),
  promptTemplateToGenNewsTitles: z.string().openapi({ example: 'Create a news title for a recent event: {event_summary} for this website.' }),
  promptTemplateToGenSeriesTitles: z.string().openapi({ example: 'Suggest a series title for an post about {series_theme} in this website.' }),
  promptTemplateToGenArticleContent: z.string().openapi({ example: 'Write an article about {topic} focusing on {aspect} for this website.' }),
  promptTemplateToGenArticleMetadata: z.string().openapi({ example: 'Generate detailed article metadata for an post about {post_topic} for this website.' }),
  promptTemplateToGenPostScript: z.string().openapi({ example: 'Create an post script for an post on {post_topic} for this website.' }),
  promptTemplateToGenPostBackground: z.string().openapi({ example: 'Describe an post background for an post about {post_topic} for this website.' }),
  promptTemplateToGenPostAudio: z.string().openapi({ example: 'Draft a script segment for an audio post discussing {segment_topic} for this website.' }),
  promptTemplateToGenPostBackgroundMusic: z.string().openapi({ example: 'Suggest background music for an post about {post_topic} for this website.' }),
  promptTemplateToGenPostIntroMusic: z.string().openapi({ example: 'Suggest intro music for an post on {post_topic} for this website.' }),
  config: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'Config must be a valid JSON string.' }
  ).openapi({ example: '{"audioGenerator": "gemini", "audioGeneratorConfig": {"model": "gemini-2.5-flash-preview-tts", "temperature": 0.7}}' }),
  languageCode: z.string().length(2).openapi({ example: 'en' }),
}).openapi('WebsiteBase');

export const WebsiteSchema = WebsiteBaseSchema.extend({
  id: z.number().int().positive().openapi({ example: 1 }),
  createdAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
  updatedAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
}).openapi('Website');

export const WebsiteCreateRequestSchema = WebsiteBaseSchema;

export const WebsiteCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Website created successfully.'),
  id: z.number().int().positive().openapi({ example: 123 }),
}).openapi('WebsiteCreateResponse');

export const WebsiteSummarySchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'Technology Updates' }),
  slug: z.string().optional().openapi({ example: 'technology-updates' }),
  languageCode: z.string().length(2).openapi({ example: 'en' }),
}).openapi('WebsiteSummary');

// Enum for sortable fields for Websites
export const WebsiteSortBySchema = z.enum([
  'id',
  'name',
  'languageCode',
  'createdAt',
  'updatedAt'
]).openapi({ description: 'Field to sort websites by.', example: 'name' });

// Enum for sort order (can be moved to commonSchemas if used across more modules)
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi({ description: 'Sort order.', example: 'asc' });

// Schema for query parameters when listing websites
export const ListWebsitesQuerySchema = z.object({
    page: z.string().optional().default('1').transform(Number).pipe(z.number().int().positive().openapi({
      example: 1,
      description: 'Page number for pagination, defaults to 1.'
    })),
    limit: z.string().optional().default('10').transform(Number).pipe(z.number().int().positive().openapi({
      example: 10,
      description: 'Number of items per page, defaults to 10.'
    })),
    name: z.string().optional().openapi({
      example: 'Tech',
      description: 'Filter by website name (case-insensitive, partial match).'
    }),
    languageCode: z.string().length(2).optional().openapi({
      example: 'en',
      description: 'Filter by website language code.'
    }),
    sortBy: WebsiteSortBySchema.optional().default('name')
      .openapi({ description: 'Field to sort websites by.', example: 'name' }),
    sortOrder: SortOrderSchema.optional().default('asc')
      .openapi({ description: 'Sort order (asc/desc).', example: 'asc' })
  }).openapi('ListWebsitesQuery');

export const ListWebsitesResponseSchema = z.object({
  websites: z.array(WebsiteSummarySchema),
  pagination: PaginationInfoSchema,
}).openapi('ListWebsitesResponse');

export const GetWebsiteResponseSchema = z.object({
      website: WebsiteSchema
}).openapi('GetWebsiteResponse');

export const WebsiteUpdateRequestSchema = WebsiteBaseSchema.partial().openapi('WebsiteUpdateRequest');

export const WebsiteUpdateResponseSchema = MessageResponseSchema.extend({
    // The 'message' field will now be inherited from MessageResponseSchema (z.string())
}).openapi('WebsiteUpdateResponse');

export const WebsiteDeleteResponseSchema = MessageResponseSchema.extend({
    message: z.literal("Website deleted successfully.")
}).openapi('WebsiteDeleteResponse');

// Specific Error Schemas for Websites
export const WebsiteNameExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.literal("Website name already exists.")
}).openapi('WebsiteNameExistsError');

export const WebsiteSlugExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.literal("Website slug already exists.")
}).openapi('WebsiteSlugExistsError');

export const WebsiteCreateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.literal("Failed to create website.")
    // errors: z.record(z.string()).optional().openapi({ example: { name: 'Name is required' } })
}).openapi('WebsiteCreateFailedError');

export const WebsiteUpdateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.literal("Failed to update website.")
}).openapi('WebsiteUpdateFailedError');

export const WebsiteDeleteFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
    // As per spec: "Cannot delete website: It is referenced by existing posts or series."
    message: z.string().openapi({example: "Cannot delete website: It is referenced by existing posts or series."})
}).openapi('WebsiteDeleteFailedError');

export const WebsiteNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
    message: z.literal("Website not found.")
}).openapi('WebsiteNotFoundError');
