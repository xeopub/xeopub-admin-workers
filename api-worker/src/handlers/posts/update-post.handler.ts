import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostUpdateRequestSchema,
  PostUpdateResponseSchema,
  PostUpdateFailedErrorSchema,
  PostNotFoundErrorSchema,
  PostSlugExistsErrorSchema
} from '../../schemas/post.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';
import { generateSlug } from '../../utils/slugify';

const camelToSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export const updatePostHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramParseResult = PathIdParamSchema.safeParse(c.req.param());

  if (!paramParseResult.success) {
    return c.json(PostNotFoundErrorSchema.parse({ message: 'Invalid post ID format.' }), 400);
  }
  const { id } = paramParseResult.data;

  const body = await c.req.json();
  const parseResult = PostUpdateRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(PostUpdateFailedErrorSchema.parse({
            message: 'Invalid request body.',
      errors: parseResult.error.flatten().fieldErrors,
    }), 400);
  }

  const updates = parseResult.data;

  if (Object.keys(updates).length === 0) {
    return c.json(PostUpdateFailedErrorSchema.parse({
            message: 'No update fields provided.',
    }), 400);
  }

  try {
    // Fetch the current post to get website_id and series_id if slug or title is being updated
    const currentPost = await c.env.DB.prepare('SELECT slug, title, website_id, series_id FROM posts WHERE id = ?1')
      .bind(id)
      .first<{ slug: string; title: string; website_id: number; series_id: number | null }>();

    if (!currentPost) {
      return c.json(PostNotFoundErrorSchema.parse({ message: 'Post not found.' }), 404);
    }

    let newSlug = updates.slug;
    if (updates.title && (!updates.slug || updates.slug.trim() === '')) {
      // If title is updated and slug is not provided (or is empty), regenerate slug
      newSlug = generateSlug(updates.title);
    } else if (updates.slug) {
      // If slug is explicitly provided, use it (it might be an intentional change)
      newSlug = updates.slug;
    }

    // If slug has changed or is being generated, check for uniqueness
    if (newSlug && newSlug !== currentPost.slug) {
      let slugCheckQuery;
      const targetWebsiteId = updates.websiteId ?? currentPost.website_id;
      const targetSeriesId = updates.seriesId !== undefined ? updates.seriesId : currentPost.series_id;

      if (targetSeriesId) {
        slugCheckQuery = c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?1 AND website_id = ?2 AND series_id = ?3 AND id != ?4')
          .bind(newSlug, targetWebsiteId, targetSeriesId, id);
      } else {
        slugCheckQuery = c.env.DB.prepare('SELECT id FROM posts WHERE slug = ?1 AND website_id = ?2 AND series_id IS NULL AND id != ?3')
          .bind(newSlug, targetWebsiteId, id);
      }
      const existingPostWithSlug = await slugCheckQuery.first();
      if (existingPostWithSlug) {
        return c.json(PostSlugExistsErrorSchema.parse({
                    message: 'Post slug already exists for this website/series combination.',
        }), 400);
      }
      updates.slug = newSlug; // Ensure the updates object has the new slug
    }

    const fieldsToUpdate: string[] = [];
    const bindings: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) { // Only include fields that are actually being updated
        const snakeCaseKey = camelToSnake(key);
        fieldsToUpdate.push(`${snakeCaseKey} = ?${paramIndex++}`);
        if (key === 'freezeStatus' && typeof value === 'boolean') {
          bindings.push(value ? 1 : 0); // Convert boolean to 0/1 for SQLite
        } else {
          bindings.push(value);
        }
      }
    });

    if (fieldsToUpdate.length === 0) {
      // This can happen if only `slug` was in `updates` but it was the same as current, or if title was updated but generated slug was same
      // Or if all values were undefined (though caught earlier by Object.keys(updates).length === 0)
      return c.json(PostUpdateResponseSchema.parse({ message: 'No changes detected to update.' }), 200);
    }

    // Add updated_at timestamp
    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);
    // Add last_status_change_at if status is changing
    if (updates.status !== undefined) {
        fieldsToUpdate.push(`last_status_change_at = CURRENT_TIMESTAMP`);
    }

    bindings.push(id); // For the WHERE clause

    const updateStatement = `UPDATE posts SET ${fieldsToUpdate.join(', ')} WHERE id = ?${paramIndex}`;
    const result = await c.env.DB.prepare(updateStatement).bind(...bindings).run();

    if (result.success && result.meta.changes > 0) {
      return c.json(PostUpdateResponseSchema.parse({ message: 'Post updated successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
      // This could mean the post was not found, or the data provided was identical to existing data
      // We already check for not found, so this means data was identical or no effective change
      return c.json(PostUpdateResponseSchema.parse({ message: 'Post updated successfully (no changes applied).' }), 200);
    } else {
      console.error('Failed to update post, D1 result:', result);
      return c.json(PostUpdateFailedErrorSchema.parse({
                message: 'Failed to update post in the database.',
      }), 500);
    }
  } catch (error) {
    console.error(`Error updating post ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({
            message: 'An unexpected error occurred while updating the post.',
    }), 500);
  }
};