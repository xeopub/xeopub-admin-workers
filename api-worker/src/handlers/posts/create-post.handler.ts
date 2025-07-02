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
    let slugCheckQuery;
    if (seriesId) {
      slugCheckQuery = c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?1 AND website_id = ?2 AND series_id = ?3').bind(slug, websiteId, seriesId);
    } else {
      // If no seriesId, check slug uniqueness only within the website (where series_id IS NULL)
      slugCheckQuery = c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?1 AND website_id = ?2 AND series_id IS NULL').bind(slug, websiteId);
    }
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
            'INSERT INTO posts (website_id, series_id, title, slug, description, markdown_content, tags, type, first_comment, script, audio_bucket_key, background_bucket_key, background_music_bucket_key, intro_music_bucket_key, video_bucket_key, thumbnail_bucket_key, article_image_bucket_key, thumbnail_gen_prompt, article_image_gen_prompt, scheduled_publish_at, status_on_youtube, status_on_website, status_on_x, freeze_status, status, last_status_change_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, CURRENT_TIMESTAMP)'
    ).bind(
      postData.websiteId,
      postData.seriesId ?? null,
      postData.title,
      postData.slug,
      postData.description,
      postData.markdownContent,
      postData.tags ?? '[]',
      postData.type,
      postData.firstComment ?? null,
      postData.script ?? '[]',
      postData.audioBucketKey ?? null,
      postData.backgroundBucketKey ?? null,
      postData.backgroundMusicBucketKey ?? null,
      postData.introMusicBucketKey ?? null,
      postData.videoBucketKey ?? null,
      postData.thumbnailBucketKey ?? null,
      postData.articleImageBucketKey ?? null,
      postData.thumbnailGenPrompt ?? null,
      postData.articleImageGenPrompt ?? null,
      postData.scheduledPublishAt ?? null,
      postData.statusOnYoutube ?? null,
      postData.statusOnWebsite ?? null,
      postData.statusOnX ?? null,
      postData.freezeStatus === undefined ? 1 : (postData.freezeStatus ? 1 : 0), // Convert boolean to 0/1 for SQLite
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