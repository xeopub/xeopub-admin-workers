import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostCreateRequestSchema,
  PostCreateResponseSchema,
  PostCreateFailedErrorSchema,
  PostSlugExistsErrorSchema
} from '../../schemas/post.schemas';
import { generateSlug } from '../../utils/slugify'; // Assuming this utility exists

export const createPostHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const body = await c.req.json();
  const parseResult = PostCreateRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(PostCreateFailedErrorSchema.parse({
      message: 'Invalid request body.',
      errors: parseResult.error.flatten().fieldErrors,
    }), 400);
  }

  const { title, websiteId, seriesId } = parseResult.data;
  let slug = parseResult.data.slug;

  // Generate slug if not provided or if it's just whitespace
  if (!slug || slug.trim() === '') {
    slug = generateSlug(title);
  }

  // Check if slug is unique for the given websiteId and seriesId (if seriesId is present)
  try {
    const slugCheckQuery = c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?1 AND website_id = ?2 AND series_id = ?3').bind(slug, websiteId, seriesId);
    const existingPost = await slugCheckQuery.first();

    if (existingPost) {
      return c.json(PostSlugExistsErrorSchema.parse({
                message: 'Post slug already exists for this website/series combination.',
      }), 400);
    }
  } catch (dbError) {
    console.error('Error checking for existing slug:', dbError);
    return c.json(PostCreateFailedErrorSchema.parse({
            message: 'Database error while checking for existing slug.',
    }), 500);
  }

  const postData = { ...parseResult.data, slug }; // Use the (potentially generated) slug

  try {
    const statement = c.env.DB.prepare(
            'INSERT INTO posts (website_id, series_id, title, slug, description, markdown_content, tags, type, featured_image_bucket_key, featured_image_gen_prompt, scheduled_publish_at, status_on_x, freeze_status, status, last_status_change_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, CURRENT_TIMESTAMP)'
    ).bind(
      postData.websiteId,
      postData.seriesId,
      postData.title,
      postData.slug,
      postData.description,
      postData.markdownContent,
      postData.tags ?? '[]',
      postData.type,
      postData.featuredImageBucketKey ?? null,
      postData.featuredImageGenPrompt ?? null,
      postData.scheduledPublishAt ?? null,
      postData.statusOnX ?? null,
      postData.freezeStatus === undefined ? 1 : (postData.freezeStatus ? 1 : 0),
      postData.status ?? 'draft'
    );
    const result = await statement.run();

    if (result.success && result.meta.last_row_id) {
      return c.json(PostCreateResponseSchema.parse({
        message: 'Post created successfully.',
        id: result.meta.last_row_id,
      }), 201);
    } else {
      console.error('Failed to insert post, D1 result:', result);
      return c.json(PostCreateFailedErrorSchema.parse({
                message: 'Failed to save post to the database.',
      }), 500);
    }
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json(PostCreateFailedErrorSchema.parse({
            message: 'An unexpected error occurred while creating the post.',
    }), 500);
  }
};