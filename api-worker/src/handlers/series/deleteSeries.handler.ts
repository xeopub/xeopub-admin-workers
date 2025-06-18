import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  SeriesDeleteResponseSchema,
  SeriesNotFoundErrorSchema,
  SeriesDeleteFailedErrorSchema
} from '../../schemas/seriesSchemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

export const deleteSeriesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    // 1. Check if series exists
    const seriesExists = await c.env.DB.prepare('SELECT id FROM series WHERE id = ?1')
      .bind(id)
      .first<{ id: number }>();

    if (!seriesExists) {
      return c.json(SeriesNotFoundErrorSchema.parse({ success: false, message: 'Series not found.' }), 404);
    }

    // 2. Check for associated posts
    const associatedPost = await c.env.DB.prepare('SELECT id FROM posts WHERE series_id = ?1 LIMIT 1')
      .bind(id)
      .first<{ id: number }>();

    if (associatedPost) {
      return c.json(SeriesDeleteFailedErrorSchema.parse({ success: false, message: 'Cannot delete series: It has associated posts.' }), 400);
    }

    // 3. Delete series
    const stmt = c.env.DB.prepare('DELETE FROM series WHERE id = ?1').bind(id);
    const result = await stmt.run();

    if (result.success && result.meta.changes > 0) {
      return c.json(SeriesDeleteResponseSchema.parse({ success: true, message: 'Series deleted successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
        // This case should ideally be caught by the seriesExists check, but as a fallback
        return c.json(SeriesNotFoundErrorSchema.parse({ success: false, message: 'Series not found.' }), 404);
    }else {
      console.error('Failed to delete series, D1 result:', result);
      return c.json(SeriesDeleteFailedErrorSchema.parse({ success: false, message: 'Failed to delete series.' }), 500);
    }

  } catch (error) {
    console.error('Error deleting series:', error);
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to delete series due to a server error.' }), 500);
  }
};
