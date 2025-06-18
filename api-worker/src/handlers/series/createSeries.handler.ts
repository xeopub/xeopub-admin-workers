import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  SeriesCreateRequestSchema,
  SeriesCreateResponseSchema,
  SeriesSlugExistsErrorSchema,
  SeriesCreateFailedErrorSchema
} from '../../schemas/seriesSchemas';
import { GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas'; // For website not found
import { generateSlug, ensureUniqueSlug } from '../../utils/slugify';

export const createSeriesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    return c.json(SeriesCreateFailedErrorSchema.parse({ success: false, message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = SeriesCreateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(SeriesCreateFailedErrorSchema.parse({ 
        success: false, 
        message: 'Invalid input for creating series.',
        // errors: validationResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { title, website_id } = validationResult.data;
  let slug = validationResult.data.slug;
  const description = validationResult.data.description ?? null;

  if (!slug || slug.startsWith('temp-slug-')) {
    const newSlug = generateSlug(title);
    slug = newSlug || `series-${Date.now()}`; // Fallback if title results in an empty slug
  }


  try {
    // 1. Validate website_id
    const websiteExists = await c.env.DB.prepare('SELECT id FROM websites WHERE id = ?1')
      .bind(website_id)
      .first<{ id: number }>();

    if (!websiteExists) {
      return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'Website not found.' }), 400);
    }

    // 2. Check if series title already exists within the same website_id
    const existingSeries = await c.env.DB.prepare('SELECT id FROM series WHERE title = ?1 AND website_id = ?2')
      .bind(title, website_id)
      .first<{ id: number }>();

    if (existingSeries) {
      return c.json(SeriesCreateFailedErrorSchema.parse({ success: false, message: 'Series title already exists in this website.' }), 400);
    }

    // Ensure the slug is unique
    slug = await ensureUniqueSlug(c.env.DB, slug, 'series', 'slug', 'id');

    // 3. Store series in the database
    const stmt = c.env.DB.prepare(
      'INSERT INTO series (title, slug, description, website_id) VALUES (?1, ?2, ?3, ?4)'
    ).bind(title, slug, description, website_id);
    
    const result = await stmt.run();

    if (result.success && result.meta.last_row_id) {
      return c.json(SeriesCreateResponseSchema.parse({
        success: true,
        message: 'Series created successfully.',
        seriesId: result.meta.last_row_id
      }), 201);
    } else {
      console.error('Failed to insert series, D1 result:', result);
      // This could be a D1 error or the unique constraint (website_id, title) if not caught above (race condition, though unlikely here)
      return c.json(SeriesCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create series.' }), 500);
    }

  } catch (error) {
    console.error('Error creating series:', error);
    // Check for unique constraint violation error (specific to D1/SQLite syntax if possible)
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint failed: series.slug')) {
        return c.json(SeriesSlugExistsErrorSchema.parse({ success: false, message: 'Series slug already exists.' }), 400);
      }
      if (error.message.includes('UNIQUE constraint failed: series.title')) { // Assuming you might have a unique constraint on (title, website_id) or similar for title
        return c.json(SeriesCreateFailedErrorSchema.parse({ success: false, message: 'Series title already exists in this website.' }), 400);
      }
    }
    return c.json(SeriesCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create series due to a server error.' }), 500);
  }
};
