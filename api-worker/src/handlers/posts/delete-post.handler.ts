import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  PostDeleteResponseSchema,
  PostNotFoundErrorSchema,
  PostDeleteFailedErrorSchema
} from '../../schemas/post.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

export const deletePostHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramParseResult = PathIdParamSchema.safeParse(c.req.param());

  if (!paramParseResult.success) {
    return c.json(PostNotFoundErrorSchema.parse({ message: 'Invalid post ID format.' }), 400);
  }
  const { id } = paramParseResult.data;

  try {
    // First, check if the post exists
    const postExists = await c.env.DB.prepare('SELECT id FROM posts WHERE id = ?1').bind(id).first();
    if (!postExists) {
      return c.json(PostNotFoundErrorSchema.parse({ message: 'Post not found.' }), 404);
    }

    const result = await c.env.DB.prepare('DELETE FROM posts WHERE id = ?1').bind(id).run();

    if (result.success && result.meta.changes > 0) {
      return c.json(PostDeleteResponseSchema.parse({ message: 'Post deleted successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
      // This case should ideally be caught by the check above, but as a fallback:
      return c.json(PostNotFoundErrorSchema.parse({ message: 'Post not found, nothing to delete.' }), 404);
    } else {
      console.error('Failed to delete post, D1 result:', result);
      return c.json(PostDeleteFailedErrorSchema.parse({
                message: 'Failed to delete post from the database.',
      }), 500);
    }
  } catch (error) {
    console.error(`Error deleting post ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({
            message: 'An unexpected error occurred while deleting the post.',
    }), 500);
  }
};