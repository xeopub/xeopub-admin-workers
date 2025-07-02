// src/handlers/series/updateSeries.handler.ts
import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  SeriesUpdateRequestSchema,
  SeriesUpdateResponseSchema,
  SeriesNotFoundErrorSchema,
  SeriesSlugExistsErrorSchema,
  SeriesUpdateFailedErrorSchema,
} from '../../schemas/series.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';
import { generateSlug, ensureUniqueSlug } from '../../utils/slugify';

interface ExistingSeries {
  id: number;
  title: string;
  slug: string; // slug is NOT NULL in DB
  description: string | null;
  website_id: number;
}

export const updateSeriesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());
  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(SeriesUpdateFailedErrorSchema.parse({ message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = SeriesUpdateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(SeriesUpdateFailedErrorSchema.parse({ 
        
        message: 'Invalid input for updating series.',
        // errors: validationResult.error.flatten().fieldErrors // Consider adding detailed errors
    }), 400);
  }

  const updateData = validationResult.data;

  if (Object.keys(updateData).length === 0) {
    return c.json(SeriesUpdateResponseSchema.parse({ message: 'Series updated successfully. No changes detected.' }), 200);
  }

  try {
    // 1. Fetch existing series
    const existingSeries = await c.env.DB.prepare('SELECT id, title, slug, description, website_id FROM series WHERE id = ?1')
      .bind(id)
      .first<ExistingSeries>();

    if (!existingSeries) {
      return c.json(SeriesNotFoundErrorSchema.parse({ message: 'Series not found.' }), 404);
    }

    // 2. Validate website_id if changed
    if (updateData.websiteId !== undefined && updateData.websiteId !== existingSeries.website_id) {
      const websiteExists = await c.env.DB.prepare('SELECT id FROM websites WHERE id = ?1')
        .bind(updateData.websiteId)
        .first<{ id: number }>();
      if (!websiteExists) {
        return c.json(GeneralBadRequestErrorSchema.parse({ message: 'New website not found.' }), 400);
      }
    }
    
    // 3. Check for title uniqueness if title or website_id is changing
    // This specific check for (title, website_id) might be a business rule not enforced by a DB constraint.
    // The DB schema only has UNIQUE(slug) for the series table.
    if (updateData.title !== undefined || updateData.websiteId !== undefined) {
        const checkTitle = updateData.title !== undefined ? updateData.title : existingSeries.title;
        const checkWebsiteId = updateData.websiteId !== undefined ? updateData.websiteId : existingSeries.websiteId;
        
        if (checkTitle !== existingSeries.title || checkWebsiteId !== existingSeries.websiteId) {
            const conflictingSeriesByTitle = await c.env.DB.prepare(
              'SELECT id FROM series WHERE title = ?1 AND website_id = ?2 AND id != ?3'
            ).bind(checkTitle, checkWebsiteId, id).first<{ id: number }>();
      
            if (conflictingSeriesByTitle) {
              return c.json(SeriesUpdateFailedErrorSchema.parse({ message: 'Series title already exists in this website for another series.' }), 400);
            }
        }
    }

    // 4. Slug processing
    let newSlug: string | undefined = undefined; // Undefined means slug won't be updated

    if (updateData.slug && updateData.slug.trim() !== '') { // Slug is explicitly provided and not empty
      if (updateData.slug !== existingSeries.slug) {
        newSlug = updateData.slug;
      }
    } else if (updateData.title && updateData.title !== existingSeries.title) { // Title changed, slug not provided or was empty
      newSlug = generateSlug(updateData.title) || `series-${id}-${Date.now()}`;
    } else if (updateData.slug && updateData.slug.trim() === '') { // Slug explicitly set to empty string
        // Generate slug from title if slug is cleared
        const titleForSlug = updateData.title || existingSeries.title;
        newSlug = generateSlug(titleForSlug) || `series-${id}-${Date.now()}`;
    }


    if (newSlug && newSlug !== existingSeries.slug) {
      // Ensure the new slug is unique, excluding the current series ID
      newSlug = await ensureUniqueSlug(c.env.DB, newSlug, 'series', 'slug', 'id', id);
    }

    // 5. Build and execute update query
    const fieldsToUpdate: string[] = [];
    const bindings: (string | number | null)[] = [];
    let bindingIndex = 1;

    const addField = (fieldName: keyof ExistingSeries, valueFromUpdate: any) => {
      if (valueFromUpdate !== undefined && valueFromUpdate !== existingSeries[fieldName]) {
        fieldsToUpdate.push(`${fieldName} = ?${bindingIndex}`);
        bindings.push(valueFromUpdate);
        bindingIndex++;
      }
    };

    addField('title', updateData.title);
    if (updateData.description !== undefined) { // Handle description separately for nullability
        if (updateData.description === null && existingSeries.description !== null) {
            fieldsToUpdate.push(`description = ?${bindingIndex}`);
            bindings.push(null);
            bindingIndex++;
        } else if (updateData.description !== null && updateData.description !== existingSeries.description) {
            fieldsToUpdate.push(`description = ?${bindingIndex}`);
            bindings.push(updateData.description);
            bindingIndex++;
        }
    }
    addField('website_id', updateData.websiteId);

    if (newSlug && newSlug !== existingSeries.slug) { 
      fieldsToUpdate.push(`slug = ?${bindingIndex}`);
      bindings.push(newSlug);
      bindingIndex++;
    }

    if (fieldsToUpdate.length === 0) {
      return c.json(SeriesUpdateResponseSchema.parse({ message: 'Series updated successfully. No changes detected.' }), 200);
    }

    fieldsToUpdate.push(`updated_at = CURRENT_TIMESTAMP`);
    bindings.push(id); // Add ID for the WHERE clause

    const query = `UPDATE series SET ${fieldsToUpdate.join(', ')} WHERE id = ?${bindingIndex}`;
    const stmt = c.env.DB.prepare(query).bind(...bindings);
    const result = await stmt.run();

    if (result.success) {
      return c.json(SeriesUpdateResponseSchema.parse({ message: 'Series updated successfully.' }), 200);
    } else {
      console.error('Failed to update series, D1 result:', result);
      return c.json(SeriesUpdateFailedErrorSchema.parse({ message: 'Failed to update series.' }), 500);
    }

  } catch (error) {
    console.error('Error updating series:', error);
    if (error instanceof Error) {
        if (error.message.includes('UNIQUE constraint failed: series.slug')) {
            return c.json(SeriesSlugExistsErrorSchema.parse({ message: 'Series slug already exists.' }), 400);
        }
        // Example: if you had a UNIQUE constraint on (title, website_id) in the DB
        // if (error.message.includes('UNIQUE constraint failed: series.title') && error.message.includes('series.website_id')) {
        //     return c.json(SeriesUpdateFailedErrorSchema.parse({ message: 'Series title already exists in this website.' }), 400);
        // }
    }
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to update series due to a server error.' }), 500);
  }
};
