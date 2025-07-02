import { z } from '@hono/zod-openapi';

// Schema for a single post, tailored for the 'What's Next' response
export const WhatsNextPostSchema = z.object({
  id: z.number().openapi({ example: 123 }),
  title: z.string().openapi({ example: 'The Future of AI' }),
  slug: z.string().openapi({ example: 'the-future-of-ai' }),
  status: z.string().openapi({ example: 'draft' }),
  websiteId: z.number().openapi({ example: 1 }),
  seriesId: z.number().nullable().openapi({ example: 10 }),
  websiteName: z.string().nullable().openapi({ example: 'Tech Uncovered' }),
  seriesName: z.string().nullable().openapi({ example: 'AI Revolution' }),
  thumbnailGenPrompt: z.string().nullable().openapi({ example: 'A brain made of circuits' }),
  articleImageGenPrompt: z.string().nullable().openapi({ example: 'A robot writing an article' }),
  scheduledPublishAt: z.string().datetime().nullable().openapi({ example: '2025-07-01T12:00:00Z' }),
  freezeStatus: z.boolean().openapi({ example: true }),
  lastStatusChangeAt: z.string().datetime().openapi({ example: '2025-06-23T21:00:00Z' }),
  updatedAt: z.string().datetime().openapi({ example: '2025-06-23T21:00:00Z' }),
  createdAt: z.string().datetime().openapi({ example: '2025-06-20T10:00:00Z' }),
}).openapi('WhatsNextPost');

// Schema for a simple list of posts
const PostListSectionSchema = z.object({
	posts: z.array(WhatsNextPostSchema),
}).openapi('PostListSection');

// Schema for the 'To Research' section, which groups posts by series
export const ToResearchSeriesSchema = z.object({
  seriesId: z.number(),
  seriesName: z.string().nullable(),
  websiteId: z.number(),
  websiteName: z.string().nullable(),
  posts: z.array(WhatsNextPostSchema),
}).openapi('ToResearchSeries');

const ToResearchSectionSchema = z.object({
  series: z.array(ToResearchSeriesSchema),
}).openapi('ToResearchSection');

// Schema for the 'Waiting & Generating' section counts
export const WaitingAndGeneratingSectionSchema = z.object({
  materialGenerated: z.number().openapi({ example: 5 }),
  generatingVideo: z.number().openapi({ example: 2 }),
  generatedNotPublished: z.number().openapi({ example: 3 }),
}).openapi('WaitingAndGeneratingSection');

// The main response schema for the 'What's Next' endpoint
export const WhatsNextResponseSchema = z.object({
  toGenerateMaterial: PostListSectionSchema,
  waitingAndGenerating: WaitingAndGeneratingSectionSchema,
  toPublishOnYouTube: PostListSectionSchema,
  toPublishOnX: PostListSectionSchema,
  toResearch: ToResearchSectionSchema,
}).openapi('WhatsNextResponse');

