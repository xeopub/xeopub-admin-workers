import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostSchema,
  GetPostResponseSchema,
  PostNotFoundErrorSchema
} from '../../schemas/post.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

const snakeToCamel = (s: string) => s.replace(/(_\w)/g, k => k[1].toUpperCase());

export const getPostByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramParseResult = PathIdParamSchema.safeParse(c.req.param());

  if (!paramParseResult.success) {
    return c.json(PostNotFoundErrorSchema.parse({ message: 'Invalid post ID format.' }), 400);
  }

  const { id } = paramParseResult.data;

  try {
    const dbPost = await c.env.DB.prepare(
      `SELECT 
        id, title, slug, description, markdown_content, website_id, series_id, status, 
        scheduled_publish_at, last_status_change_at, type, tags, created_at, updated_at, 
        featured_image_bucket_key, featured_image_gen_prompt,
        status_on_x, freeze_status
      FROM posts WHERE id = ?1`
    ).bind(id).first<any>();

    if (!dbPost) {
      return c.json(PostNotFoundErrorSchema.parse({ message: 'Post not found.' }), 404);
    }

    const camelCasePost = Object.fromEntries(
      Object.entries(dbPost).map(([key, value]) => [snakeToCamel(key), value])
    );

    const parsedPost = PostSchema.safeParse(camelCasePost);

    if (!parsedPost.success) {
      console.error(`Error parsing post ID ${id} from DB:`, parsedPost.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({
                message: 'Error processing post data from database.',
      }), 500);
    }

    return c.json(GetPostResponseSchema.parse({
      post: parsedPost.data,
    }), 200);

  } catch (error) {
    console.error(`Error fetching post by ID ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({
            message: 'Failed to retrieve post due to a server error.',
    }), 500);
  }
};