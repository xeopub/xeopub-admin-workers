import { Context } from 'hono';
import { z } from 'zod';
import type { CloudflareEnv } from '../../env';
import {
  SeriesSummarySchema,
  ListSeriesResponseSchema
} from '../../schemas/seriesSchemas';
import { GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

// Schema for query parameters
const ListSeriesQuerySchema = z.object({
  website_id: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()).optional(),
});

interface SeriesSummaryFromDB {
  id: number;
  title: string;
  slug: string; // Added slug
  website_id: number;
}

export const listSeriesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListSeriesQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ 
        success: false, 
        message: 'Invalid query parameters.',
        // errors: queryParseResult.error.flatten().fieldErrors
    }), 400);
  }

  const { website_id } = queryParseResult.data;

  try {
    let query = 'SELECT id, title, slug, website_id FROM series'; // Added slug
    const bindings: (number | string)[] = [];

    if (website_id !== undefined) {
      query += ' WHERE website_id = ?1';
      bindings.push(website_id);
    }
    query += ' ORDER BY id ASC';

    const stmt = bindings.length > 0 ? c.env.DB.prepare(query).bind(...bindings) : c.env.DB.prepare(query);
    const { results } = await stmt.all<SeriesSummaryFromDB>();

    if (!results) {
      return c.json(ListSeriesResponseSchema.parse({ success: true, series: [] }), 200);
    }

    // Validate each summary - though if query is specific, this is more of a sanity check
    const seriesSummaries = results.map(dbSeries => {
      const validation = SeriesSummarySchema.safeParse({
        ...dbSeries
      });
      if (!validation.success) {
        console.warn(`Data for series ID ${dbSeries.id} failed SeriesSummarySchema validation:`, validation.error.flatten());
        return null; // Filter out invalid ones
      }
      return validation.data;
    }).filter(s => s !== null);

    return c.json(ListSeriesResponseSchema.parse({ success: true, series: seriesSummaries }), 200);

  } catch (error) {
    console.error('Error listing series:', error);
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to list series due to a server error.' }), 500);
  }
};
