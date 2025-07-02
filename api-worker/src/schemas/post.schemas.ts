// src/schemas/postSchemas.ts
import { z } from '@hono/zod-openapi';
import {
  MessageResponseSchema,
  GeneralBadRequestErrorSchema,
  GeneralNotFoundErrorSchema,
  GeneralServerErrorSchema
} from './common.schemas';

// Enum for post publication type, based on database schema
export const PostPublicationTypeSchema = z.enum(['evergreen', 'news']).openapi({
  description: 'The publication type of the post (e.g., evergreen content or timely news).',
  example: 'evergreen'
});

const PostStatusOnPlatformSchema = z.enum(['none', 'scheduled', 'public', 'private', 'deleted']);

export const PostStatusSchema = z.enum([
  'draft',
  'researching',
  'researched',
  'generatingMaterial',
  'materialGenerated',
  'generatingVideo',
  'videoGenerated'
]).openapi({description: 'The current status of the post.', example: 'draft'});

const PostBaseSchema = z.object({
  title: z.string().min(1).max(255).openapi({ example: 'My First Post' }),
  slug: z.string().max(255).optional().openapi({ example: 'my-first-post', description: 'The URL-friendly slug for the post. Auto-generated if not provided.' }),
  description: z.string().min(1).max(5000).openapi({ example: 'An introduction to the series.' }),
  markdownContent: z.string().min(1).openapi({ example: '# Welcome\n\nThis is the content.' }),
  tags: z.string().optional().default('[]').openapi({ example: '["tech", "astro"]', description: 'Tags for the post, stored as a string (intended as JSON stringified array).' }),
  type: PostPublicationTypeSchema,
  firstComment: z.string().max(1000).optional().nullable().openapi({ example: 'Check out our website for more!' }),
  script: z.string().optional().default('[]').openapi({ example: '[{"speaker": "Host", "line": "Welcome to the website!"}]', description: 'Post script, stored as a string (intended as JSON string).' }),
  audioBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/audio/post_audio.mp3' }),
  backgroundBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/backgrounds/background_image.png' }),
  backgroundMusicBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/music/bg_music.mp3' }),
  introMusicBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/music/intro_music.mp3' }),
  videoBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/video/final_video.mp4' }),
  thumbnailBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/thumbnails/post_thumbnail.png' }),
  articleImageBucketKey: z.string().max(255).optional().nullable().openapi({ example: 'posts/images/article_image.png' }),
  thumbnailGenPrompt: z.string().max(2000).optional().nullable().openapi({ example: 'A vibrant image of a microphone with sound waves.' }),
  articleImageGenPrompt: z.string().max(2000).optional().nullable().openapi({ example: 'A futuristic cityscape representing technology.' }),
  scheduledPublishAt: z.union([z.string().datetime({ message: "Invalid datetime string. Must be UTC ISO 8601 format." }), z.date()]).optional().nullable().openapi({ example: '2024-12-31T23:59:59Z' }),
  statusOnYoutube: PostStatusOnPlatformSchema.optional().nullable(),
  statusOnWebsite: PostStatusOnPlatformSchema.optional().nullable(),
  statusOnX: PostStatusOnPlatformSchema.optional().nullable(),
  freezeStatus: z.boolean().optional().default(true),
  status: PostStatusSchema.default('draft'),
  websiteId: z.number().int().positive(),
  seriesId: z.number().int().positive().optional().nullable(),
}).openapi('PostBase');

// Schema for data as it's stored in/retrieved from the database
// This is an intermediate schema, not directly used for API request/response validation usually
export const PostDbSchema = PostBaseSchema.extend({
  id: z.number().int().positive(),
  // Ensure all fields from DB are represented, especially those with defaults or specific types
  // slug, description, markdownContent are already in PostBaseSchema and DB ensures they are NOT NULL
  // tags and script are already in PostBaseSchema, DB stores them as TEXT
  freezeStatus: z.union([z.boolean(), z.number()]), // Stored as BOOLEAN (0 or 1 in SQLite), accept number before transform
  lastStatusChangeAt: z.union([z.string(), z.date()]), // Stored as DATETIME string or Date, will be transformed
  createdAt: z.union([z.string(), z.date()]), // Stored as DATETIME string or Date, will be transformed
  updatedAt: z.union([z.string(), z.date()]), // Stored as DATETIME string or Date, will be transformed
});

// This is the schema that PostSchema transforms into. We define it explicitly.
const PostOutputObjectSchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  websiteId: z.number().int().positive().openapi({ example: 1 }),
  seriesId: z.number().int().positive().optional().nullable().openapi({ example: 1 }),
  title: z.string().openapi({ example: 'My First Post' }),
  slug: z.string().openapi({ example: 'my-first-post' }),
  description: z.string().openapi({ example: 'An introduction to the series.' }),
  markdownContent: z.string().openapi({ example: '# Welcome\n\nThis is the content.' }),
  tags: z.string().openapi({ example: '["tech", "astro"]' }), // Kept as string as per user request
  type: PostPublicationTypeSchema,
  firstComment: z.string().optional().nullable().openapi({ example: 'Check out our website for more!' }),
  script: z.string().openapi({ example: '[{"speaker": "Host", "line": "Welcome to the website!"}]' }), // Kept as string as per user request
  audioBucketKey: z.string().optional().nullable().openapi({ example: 'posts/audio/post_audio.mp3' }),
  backgroundBucketKey: z.string().optional().nullable().openapi({ example: 'posts/backgrounds/background_image.png' }),
  backgroundMusicBucketKey: z.string().optional().nullable().openapi({ example: 'posts/music/bg_music.mp3' }),
  introMusicBucketKey: z.string().optional().nullable().openapi({ example: 'posts/music/intro_music.mp3' }),
  videoBucketKey: z.string().optional().nullable().openapi({ example: 'posts/video/final_video.mp4' }),
  thumbnailBucketKey: z.string().optional().nullable().openapi({ example: 'posts/thumbnails/post_thumbnail.png' }),
  articleImageBucketKey: z.string().optional().nullable().openapi({ example: 'posts/images/article_image.png' }),
  thumbnailGenPrompt: z.string().optional().nullable().openapi({ example: 'A vibrant image of a microphone with sound waves.' }),
  articleImageGenPrompt: z.string().optional().nullable().openapi({ example: 'A futuristic cityscape representing technology.' }),
  scheduledPublishAt: z.date().optional().nullable().openapi({ example: '2024-12-31T23:59:59Z' }),
  statusOnYoutube: PostStatusOnPlatformSchema.optional().nullable(),
  statusOnWebsite: PostStatusOnPlatformSchema.optional().nullable(),
  statusOnX: PostStatusOnPlatformSchema.optional().nullable(),
  freezeStatus: z.boolean(),
  status: PostStatusSchema,
  lastStatusChangeAt: z.date().openapi({ example: '2023-01-01T12:05:00Z' }),
  createdAt: z.date().openapi({ example: '2023-01-01T12:00:00Z' }),
  updatedAt: z.date().openapi({ example: '2023-01-01T12:10:00Z' }),
});

// Schema for API responses (transforms DB data, e.g., coerces dates)
export const PostSchema = PostDbSchema.transform(dbData => {
  const processDate = (dateInput: string | Date | null | undefined): Date | null => {
    if (dateInput === null || dateInput === undefined) return null;
    if (dateInput instanceof Date) return new Date(dateInput); // Return new Date instance to ensure it's a fresh object
    // Assuming string format from DB is 'YYYY-MM-DD HH:MM:SS'
    // D1 might return ISO 8601 strings like 'YYYY-MM-DDTHH:MM:SS.SSSZ' or 'YYYY-MM-DD HH:MM:SS'
    // new Date() is generally robust for ISO 8601 strings.
    // If specific cleaning like .replace(' ', 'T') + 'Z' is needed for non-standard strings:
    if (typeof dateInput === 'string' && dateInput.includes(' ') && !dateInput.includes('T')) {
      return new Date(dateInput.replace(' ', 'T') + 'Z');
    }
    return new Date(dateInput);
  };

  return {
    ...dbData,
    // Ensure all fields from PostDbSchema are explicitly handled or passed through if they are part of PostOutputObjectSchema
    id: dbData.id,
    websiteId: dbData.websiteId,
    seriesId: dbData.seriesId,
    title: dbData.title,
    slug: dbData.slug,
    description: dbData.description,
    markdownContent: dbData.markdownContent,
    tags: dbData.tags, // Kept as string
    type: dbData.type,
    firstComment: dbData.firstComment,
    script: dbData.script, // Kept as string
    audioBucketKey: dbData.audioBucketKey,
    backgroundBucketKey: dbData.backgroundBucketKey,
    backgroundMusicBucketKey: dbData.backgroundMusicBucketKey,
    introMusicBucketKey: dbData.introMusicBucketKey,
    videoBucketKey: dbData.videoBucketKey,
    thumbnailBucketKey: dbData.thumbnailBucketKey,
    articleImageBucketKey: dbData.articleImageBucketKey,
    thumbnailGenPrompt: dbData.thumbnailGenPrompt,
    articleImageGenPrompt: dbData.articleImageGenPrompt,
    statusOnYoutube: dbData.statusOnYoutube,
    statusOnWebsite: dbData.statusOnWebsite,
    statusOnX: dbData.statusOnX,
    status: dbData.status,
    
    // Transformed fields
    lastStatusChangeAt: processDate(dbData.lastStatusChangeAt) as Date, // Cast as Date because it's non-nullable in output
    createdAt: processDate(dbData.createdAt) as Date, // Cast as Date
    updatedAt: processDate(dbData.updatedAt) as Date, // Cast as Date
    scheduledPublishAt: processDate(dbData.scheduledPublishAt),
    freezeStatus: Boolean(dbData.freezeStatus),
  };
}).pipe(PostOutputObjectSchema) // Pipe into the explicitly defined output schema
  .openapi('Post');

export const PostCreateRequestSchema = PostBaseSchema;

export const PostCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Post created successfully.'),
  id: z.number().int().positive().openapi({ example: 101 }),
}).openapi('PostCreateResponse');

// Schema for pagination details
const PaginationSchema = z.object({
  page: z.number().int().positive().openapi({ example: 1, description: 'Current page number.' }),
  limit: z.number().int().positive().openapi({ example: 10, description: 'Number of items per page.' }),
  totalItems: z.number().int().nonnegative().openapi({ example: 100, description: 'Total number of items available.' }),
  totalPages: z.number().int().nonnegative().openapi({ example: 10, description: 'Total number of pages.' }),
}).openapi('Pagination');

// Schema for individual items in the post list response
export const PostListItemSchema = PostOutputObjectSchema.pick({
  id: true,
  title: true,
  slug: true,
  status: true,
  type: true,
  websiteId: true,
  seriesId: true,
  scheduledPublishAt: true,
  tags: true,
  freezeStatus: true,
  updatedAt: true,
  createdAt: true,
}).openapi('PostListItem');

// Enum for sortable fields
export const PostSortBySchema = z.enum([
  'id',
  'title',
  'status',
  'type',
  'websiteId',
  'seriesId',
  'scheduledPublishAt',
  'createdAt',
  'updatedAt'
]).openapi({ description: 'Field to sort posts by.', example: 'createdAt' });

// Enum for sort order
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi({ description: 'Sort order.', example: 'desc' });

export const ListPostsQuerySchema = z.object({
    page: z.string().optional().default('1').transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'Page must be positive' }),
    limit: z.string().optional().default('10').transform(val => parseInt(val, 10)).refine(val => val > 0, { message: 'Limit must be positive' }),
    status: PostStatusSchema.optional(),
    websiteId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || val > 0, { message: 'Website ID must be positive' }),
    seriesId: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined).refine(val => val === undefined || val > 0, { message: 'Series ID must be positive' }),
    title: z.string().optional(),
    type: PostPublicationTypeSchema.optional(),
    sortBy: PostSortBySchema.optional().default('createdAt'),
    sortOrder: SortOrderSchema.optional().default('desc'),
  });

export const ListPostsResponseSchema = z.object({
  posts: z.array(PostListItemSchema),
  pagination: PaginationSchema
}).openapi('ListPostsResponse');

export const GetPostResponseSchema = z.object({
  post: PostSchema
}).openapi('GetPostResponse');

export const PostUpdateRequestSchema = PostBaseSchema.partial().openapi('PostUpdateRequest');

export const PostUpdateResponseSchema = MessageResponseSchema.extend({
    message: z.string().openapi({example: 'Post updated successfully.'})
}).openapi('PostUpdateResponse');

export const PostDeleteResponseSchema = MessageResponseSchema.extend({
    message: z.literal("Post deleted successfully.")
}).openapi('PostDeleteResponse');

export const PostCreateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.string().openapi({ example: "Failed to create post." }),
}).openapi('PostCreateFailedError');

export const PostSlugExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.literal("Post slug already exists for this website/series combination.")
}).openapi('PostSlugExistsError');

export const PostUpdateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.string().openapi({ example: "Failed to update post." })
}).openapi('PostUpdateFailedError');

export const PostNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
    message: z.literal("Post not found.")
}).openapi('PostNotFoundError');

export const PostDeleteFailedErrorSchema = GeneralServerErrorSchema.extend({
    message: z.string().openapi({ example: "Failed to delete post." })
}).openapi('PostDeleteFailedError');
