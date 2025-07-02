import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import { z } from '@hono/zod-openapi';

import {
  PostSchema,
  PostListItemSchema,
  ListPostsQuerySchema,
  ListPostsResponseSchema,
  PostSortBySchema,
} from '../../schemas/post.schemas';
import {
  GeneralServerErrorSchema,
  GeneralBadRequestErrorSchema,
} from '../../schemas/common.schemas';

const snakeToCamel = (s: string) => s.replace(/(_\w)/g, k => k[1].toUpperCase());

export const listPostsHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListPostsQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ 
      message: 'Invalid query parameters.', 
      errors: queryParseResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { page, limit, status, websiteId, seriesId, title, type, sortBy, sortOrder } = queryParseResult.data;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (status) {
    whereClauses.push(`status = ?${paramIndex++}`);
    bindings.push(status);
  }
  if (websiteId) {
    whereClauses.push(`website_id = ?${paramIndex++}`);
    bindings.push(websiteId);
  }
  if (seriesId) {
    whereClauses.push(`series_id = ?${paramIndex++}`);
    bindings.push(seriesId);
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

  const validSortColumns: Record<z.infer<typeof PostSortBySchema>, string> = {
    id: 'id',
    title: 'title',
    status: 'status',
    type: 'type',
    websiteId: 'website_id',
    seriesId: 'series_id',
    scheduledPublishAt: 'scheduled_publish_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const orderByColumn = validSortColumns[sortBy] || 'created_at';
  const orderByDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const orderByString = `ORDER BY ${orderByColumn} ${orderByDirection}`;

  try {
    const postsQuery = c.env.DB.prepare(
      `SELECT 
        id, title, slug, description, markdown_content, website_id, series_id, status, 
        scheduled_publish_at, last_status_change_at, type, tags, created_at, updated_at, 
        audio_bucket_key, background_bucket_key, background_music_bucket_key, intro_music_bucket_key, 
        video_bucket_key, thumbnail_bucket_key, article_image_bucket_key,
        script, thumbnail_gen_prompt, article_image_gen_prompt,
        status_on_youtube, status_on_website, status_on_x, freeze_status, first_comment
      FROM posts ${whereString} ${orderByString} LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`
    ).bind(...bindings, limit, offset);
    
    const countQuery = c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM posts ${whereString}`
    ).bind(...bindings);

    const [postsDbResult, countResult] = await Promise.all([
      postsQuery.all(), 
      countQuery.first<{ total: number }>()
    ]);

    if (!postsDbResult.results || countResult === null) {
        console.error('Failed to fetch posts or count, D1 results:', postsDbResult, countResult);
        return c.json(GeneralServerErrorSchema.parse({ 
          message: 'Failed to retrieve posts from the database.'
        }), 500);
    }

    const processedPosts = postsDbResult.results.map((dbPost: any) => {
      const camelCasePost = Object.fromEntries(
        Object.entries(dbPost).map(([key, value]) => [snakeToCamel(key), value])
      );
      const parsedPost = PostSchema.safeParse(camelCasePost);
      if (!parsedPost.success) {
        console.error(`Error parsing post ID ${dbPost.id} in list:`, parsedPost.error.flatten());
      }
      return parsedPost.success ? parsedPost.data : null;
    }).filter(Boolean);

    const validatedPostsList = z.array(PostListItemSchema).safeParse(processedPosts);

    if (!validatedPostsList.success) {
        console.error('Final post list validation error:', validatedPostsList.error.flatten());
        return c.json(GeneralServerErrorSchema.parse({ 
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
      posts: validatedPostsList.data,
      pagination: pagination,
    }), 200);

  } catch (error) {
    console.error('Error listing posts:', error);
    return c.json(GeneralServerErrorSchema.parse({ 
      message: 'Failed to list posts due to a server error.' 
    }), 500);
  }
};