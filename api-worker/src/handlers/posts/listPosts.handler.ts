import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostSchema,
  PostListItemSchema,
  ListPostsQuerySchema,
  ListPostsResponseSchema
} from '../../schemas/postSchemas';
import { GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas';
import { z } from 'zod';

export const listPostsHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListPostsQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ 
      success: false, 
      message: 'Invalid query parameters.', 
      errors: queryParseResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { page, limit, status, website_id, series_id, title, type } = queryParseResult.data;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (status) {
    whereClauses.push(`status = ?${paramIndex++}`);
    bindings.push(status);
  }
  if (website_id) {
    whereClauses.push(`website_id = ?${paramIndex++}`);
    bindings.push(website_id);
  }
  if (series_id) {
    whereClauses.push(`series_id = ?${paramIndex++}`);
    bindings.push(series_id);
  }
  if (title) {
    whereClauses.push(`LOWER(title) LIKE LOWER(?${paramIndex++})`);
    bindings.push(`%${title}%`);
  }
  if (type) {
    whereClauses.push(`type = ?${paramIndex++}`);
    bindings.push(type);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    // Select all fields required by PostDbSchema for transformation by PostSchema
    const postsQuery = c.env.DB.prepare(
      `SELECT 
        id, title, slug, description, markdown_content, website_id, series_id, status, 
        scheduled_publish_at, last_status_change_at, type, tags, created_at, updated_at, 
        audio_bucket_key, background_bucket_key, background_music_bucket_key, intro_music_bucket_key, 
        video_bucket_key, thumbnail_bucket_key, article_image_bucket_key,
        script, thumbnail_gen_prompt, article_image_gen_prompt,
        status_on_youtube, status_on_website, status_on_x, freezeStatus, first_comment
      FROM posts ${whereString} ORDER BY id ASC LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`
    ).bind(...bindings, limit, offset);
    
    const countQuery = c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM posts ${whereString}`
    ).bind(...bindings);

    const [postsDbResult, countResult] = await Promise.all([
      postsQuery.all<any>(), 
      countQuery.first<{ total: number }>()
    ]);

    if (!postsDbResult.results || countResult === null) {
        console.error('Failed to fetch posts or count, D1 results:', postsDbResult, countResult);
        return c.json(GeneralServerErrorSchema.parse({ 
          success: false, 
          message: 'Failed to retrieve posts from the database.'
        }), 500);
    }

    const processedPosts = postsDbResult.results.map(dbPost => {
      const parsedPost = PostSchema.safeParse(dbPost);
      if (!parsedPost.success) {
        console.error(`Error parsing post ID ${dbPost.id} in list:`, parsedPost.error.flatten());
        // Potentially skip this post or handle error. For now, we'll let it be filtered out by validatedPostsList if it's problematic.
        // Or, more strictly:
        // return null; 
        // And then filter(Boolean) before passing to PostListItemSchema.array().safeParse()
        // However, PostListItemSchema picks from PostSchema's output, so a failure here means it won't conform.
      }
      return parsedPost.success ? parsedPost.data : null; // Return null if parsing failed
    }).filter(Boolean); // Filter out any nulls from parsing errors

    // Validate the array of processed posts against z.array(PostListItemSchema)
    const validatedPostsList = z.array(PostListItemSchema).safeParse(processedPosts);

    if (!validatedPostsList.success) {
        console.error('Final post list validation error:', validatedPostsList.error.flatten());
        return c.json(GeneralServerErrorSchema.parse({ 
          success: false, 
          message: 'Error validating final post list structure.'
        }), 500);
    }

    const totalItems = countResult!.total; 
    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      page,
      limit,
      totalItems,
      totalPages,
    };

    return c.json(ListPostsResponseSchema.parse({
      success: true,
      posts: validatedPostsList.data,
      pagination: pagination,
    }), 200);

  } catch (error) {
    console.error('Error listing posts:', error);
    return c.json(GeneralServerErrorSchema.parse({ 
      success: false, 
      message: 'Failed to list posts due to a server error.' 
    }), 500);
  }
};