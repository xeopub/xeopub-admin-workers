import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  WebsiteDeleteResponseSchema,
  WebsiteNotFoundErrorSchema,
  WebsiteDeleteFailedErrorSchema
} from '../../schemas/website.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';

export const deleteWebsiteHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    // Check if website exists
    const websiteExists = await c.env.DB.prepare('SELECT id FROM websites WHERE id = ?1').bind(id).first<{ id: number }>();
    if (!websiteExists) {
      return c.json(WebsiteNotFoundErrorSchema.parse({ message: 'Website not found.' }), 404);
    }

    // Check for dependencies: posts
    const dependentPosts = await c.env.DB.prepare('SELECT id FROM posts WHERE website_id = ?1 LIMIT 1').bind(id).first<{ id: number }>();
    if (dependentPosts) {
      return c.json(WebsiteDeleteFailedErrorSchema.parse({ message: 'Cannot delete website: It is referenced by existing posts.' }), 400);
    }

    // Check for dependencies: series
    const dependentSeries = await c.env.DB.prepare('SELECT id FROM series WHERE website_id = ?1 LIMIT 1').bind(id).first<{ id: number }>();
    if (dependentSeries) {
      return c.json(WebsiteDeleteFailedErrorSchema.parse({ message: 'Cannot delete website: It is referenced by existing series.' }), 400);
    }
    


    const stmt = c.env.DB.prepare('DELETE FROM websites WHERE id = ?1').bind(id);
    const result = await stmt.run();

    if (result.success && result.meta.changes > 0) {
      return c.json(WebsiteDeleteResponseSchema.parse({ message: 'Website deleted successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
        // This case should ideally be caught by the existence check, but as a safeguard:
        return c.json(WebsiteNotFoundErrorSchema.parse({ message: 'Website not found or already deleted.' }), 404);
    }else {
      console.error('Failed to delete website, D1 result:', result);
      return c.json(WebsiteDeleteFailedErrorSchema.parse({ message: 'Failed to delete website.' }), 500);
    }

  } catch (error) {
    console.error('Error deleting website:', error);
    // This could be a foreign key constraint error if not caught by manual checks, though D1 might not enforce them by default
    return c.json(WebsiteDeleteFailedErrorSchema.parse({ message: 'Failed to delete website due to an unexpected error.' }), 500);
  }
};
