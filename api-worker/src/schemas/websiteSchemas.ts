// src/schemas/websiteSchemas.ts
import { z } from '@hono/zod-openapi';
import { 
    MessageResponseSchema, 
    PathIdParamSchema, 
    SimpleListResponseSchema, 
    ErrorSchema, // Added ErrorSchema for base error types
    GeneralBadRequestErrorSchema, 
    GeneralNotFoundErrorSchema, 
    GeneralServerErrorSchema 
} from './commonSchemas';

const WebsiteBaseSchema = z.object({
  name: z.string().max(255).openapi({ example: 'Technology Updates' }),
  slug: z.string().max(255).optional().openapi({ example: 'technology-updates', description: 'The URL-friendly slug for the website. Auto-generated if not provided.' }),
  description: z.string().max(5000).openapi({ example: 'Latest news and discussions in the tech world.' }),
  slogan: z.string().max(500).openapi({ example: 'Your daily dose of tech insights.' }),
  custom_url: z.string().max(255).openapi({ example: 'tech-unfiltered-website' }),
  default_post_background_bucket_key: z.string().openapi({ example: 'defaults/website_post_bg.mp4' }),
  default_post_thumbnail_bucket_key: z.string().openapi({ example: 'defaults/website_post_thumb.png' }),
  default_post_background_music_bucket_key: z.string().openapi({ example: 'defaults/website_music_bg.mp3' }),
  default_post_intro_music_bucket_key: z.string().openapi({ example: 'defaults/website_music_intro.mp3' }),
  first_comment_template: z.string().openapi({ example: 'Check out our latest website post on {topic}!' }),
  prompt_template_to_gen_evergreen_titles: z.string().openapi({ example: 'Generate an evergreen title about {topic} for this website.' }),
  prompt_template_to_gen_news_titles: z.string().openapi({ example: 'Create a news title for a recent event: {event_summary} for this website.' }),
  prompt_template_to_gen_series_titles: z.string().openapi({ example: 'Suggest a series title for an post about {series_theme} in this website.' }),
  prompt_template_to_gen_article_content: z.string().openapi({ example: 'Write an article about {topic} focusing on {aspect} for this website.' }),
  prompt_template_to_gen_article_metadata: z.string().openapi({ example: 'Generate detailed article metadata for an post about {post_topic} for this website.' }),
  prompt_template_to_gen_post_script: z.string().openapi({ example: 'Create an post script for an post on {post_topic} for this website.' }),
  prompt_template_to_gen_post_background: z.string().openapi({ example: 'Describe an post background for an post about {post_topic} for this website.' }),
  prompt_template_to_gen_post_audio: z.string().openapi({ example: 'Draft a script segment for an audio post discussing {segment_topic} for this website.' }),
  prompt_template_to_gen_post_background_music: z.string().openapi({ example: 'Suggest background music for an post about {post_topic} for this website.' }),
  prompt_template_to_gen_post_intro_music: z.string().openapi({ example: 'Suggest intro music for an post on {post_topic} for this website.' }),
  config: z.string().refine(
    (val) => {
      try {
        JSON.parse(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    { message: 'Config must be a valid JSON string.' }
  ).openapi({ example: '{"audioGenerator": "gemini", "audioGeneratorConfig": {"model": "gemini-2.5-flash-preview-tts", "temperature": 0.7}}' }),
  language_code: z.string().length(2).openapi({ example: 'en' }),
}).openapi('WebsiteBase');

export const WebsiteSchema = WebsiteBaseSchema.extend({
  id: z.number().int().positive().openapi({ example: 1 }),
  created_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
  updated_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
}).openapi('Website');

export const WebsiteCreateRequestSchema = WebsiteBaseSchema;

export const WebsiteCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Website created successfully.'),
  websiteId: z.number().int().positive().openapi({ example: 123 }),
}).openapi('WebsiteCreateResponse');

export const WebsiteSummarySchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'Technology Updates' }),
  slug: z.string().optional().openapi({ example: 'technology-updates' }),
  language_code: z.string().length(2).openapi({ example: 'en' }),
}).openapi('WebsiteSummary');

export const ListWebsitesResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  websites: z.array(WebsiteSummarySchema)
}).openapi('ListWebsitesResponse');

export const GetWebsiteResponseSchema = z.object({
    success: z.boolean().openapi({ example: true }),
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
