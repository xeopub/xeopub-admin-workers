import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostSchema,
  GetPostResponseSchema,
  PostNotFoundErrorSchema
} from '../../schemas/postSchemas';
import { PathIdParamSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

export const getPostByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramParseResult = PathIdParamSchema.safeParse(c.req.param());

  if (!paramParseResult.success) {
    // This case should ideally be caught by routing validation if PathIdParamSchema is used in createRoute
    return c.json(PostNotFoundErrorSchema.parse({ success: false, message: 'Invalid post ID format.' }), 400);
  }

  const { id } = paramParseResult.data;

  try {
    const dbPost = await c.env.DB.prepare(
      `SELECT 
        id, title, slug, description, markdown_content, website_id, series_id, status, 
        scheduled_publish_at, last_status_change_at, type, tags, created_at, updated_at, 
        audio_bucket_key, background_bucket_key, background_music_bucket_key, intro_music_bucket_key, 
        video_bucket_key, thumbnail_bucket_key, article_image_bucket_key,
        script, thumbnail_gen_prompt, article_image_gen_prompt,
        status_on_youtube, status_on_website, status_on_x, freezeStatus, first_comment
      FROM posts WHERE id = ?1`
    ).bind(id).first<any>();

    if (!dbPost) {
      return c.json(PostNotFoundErrorSchema.parse({ success: false, message: 'Post not found.' }), 404);
    }

    const parsedPost = PostSchema.safeParse(dbPost);

    if (!parsedPost.success) {
      console.error(`Error parsing post ID ${id} from DB:`, parsedPost.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({
        success: false,
        message: 'Error processing post data from database.',
      }), 500);
    }

    return c.json(GetPostResponseSchema.parse({
      success: true,
      post: parsedPost.data,
    }), 200);

  } catch (error) {
    console.error(`Error fetching post by ID ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({
      success: false,
      message: 'Failed to retrieve post due to a server error.',
    }), 500);
  }
};