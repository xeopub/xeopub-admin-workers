import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  SeriesSchema,
  GetSeriesResponseSchema,
  SeriesNotFoundErrorSchema
} from '../../schemas/series.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

interface SeriesFromDB {
  id: number;
  title: string;
  slug: string; // Added slug
  description: string | null;
  website_id: number;
  created_at: string;
  updated_at: string;
}

export const getSeriesByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    const dbSeries = await c.env.DB.prepare(
      'SELECT id, title, slug, description, website_id, created_at, updated_at FROM series WHERE id = ?1' // Added slug to query
    ).bind(id).first<SeriesFromDB>();

    if (!dbSeries) {
      return c.json(SeriesNotFoundErrorSchema.parse({ message: 'Series not found.' }), 404);
    }

    // Map DB fields (snake_case) to schema fields (camelCase) for validation
    const seriesForValidation = {
      id: dbSeries.id,
      title: dbSeries.title,
      slug: dbSeries.slug,
      description: dbSeries.description === null ? undefined : dbSeries.description,
      websiteId: dbSeries.website_id,
      createdAt: dbSeries.created_at,
      updatedAt: dbSeries.updated_at,
    };

    const validation = SeriesSchema.safeParse(seriesForValidation);
    if (!validation.success) {
      console.error(`Data for series ID ${dbSeries.id} failed SeriesSchema validation after DB fetch:`, validation.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing series data.' }), 500);
    }

    return c.json(GetSeriesResponseSchema.parse({ series: validation.data }), 200);

  } catch (error) {
    console.error('Error getting series by ID:', error);
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to retrieve series due to a server error.' }), 500);
  }
};
