import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  WebsiteUpdateRequestSchema,
  WebsiteUpdateResponseSchema,
  WebsiteNotFoundErrorSchema,
  WebsiteNameExistsErrorSchema,
  WebsiteUpdateFailedErrorSchema
} from '../../schemas/website.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';
import { generateSlug, ensureUniqueSlug } from '../../utils/slugify';

interface ExistingWebsite {
  id: number;
  name: string;
  slug: string | null;
}

export const updateWebsiteHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(WebsiteUpdateFailedErrorSchema.parse({ message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = WebsiteUpdateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    console.error('Update website validation error:', validationResult.error.flatten());
    return c.json(WebsiteUpdateFailedErrorSchema.parse({ message: 'Invalid input for updating website.' }), 400);
  }

  const updateData = validationResult.data;

  if (Object.keys(updateData).length === 0) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'No update data provided.' }), 400);
  }

  try {
    // Check if website exists and get its current name and slug
    const existingWebsite = await c.env.DB.prepare('SELECT id, name, slug FROM websites WHERE id = ?1').bind(id).first<ExistingWebsite>();
    if (!existingWebsite) {
      return c.json(WebsiteNotFoundErrorSchema.parse({ message: 'Website not found.' }), 404);
    }

    // If name is being updated, check for conflicts
    if (updateData.name) {
      const existingWebsiteWithName = await c.env.DB.prepare(
        'SELECT id FROM websites WHERE name = ?1 AND id != ?2'
      ).bind(updateData.name, id).first<{ id: number }>();

      if (existingWebsiteWithName) {
        return c.json(WebsiteNameExistsErrorSchema.parse({ message: 'Website name already exists.' }), 400);
      }
    }

    // Slug processing logic using ensureUniqueSlug
    let newSlugValue: string | null | undefined = undefined; // This will hold the slug to be written to DB
    let slugNeedsDatabaseUpdate = false; // Flag to indicate if the slug field in DB needs changing

    if (updateData.slug !== undefined) { // User explicitly sent a slug field
      if (!updateData.slug || updateData.slug.startsWith('temp-slug-')) {
        // Regenerate slug based on name (new name if provided, else old name)
        const nameForSlug = updateData.name || existingWebsite.name;
        newSlugValue = generateSlug(nameForSlug) || `website-${id}-${Date.now()}`; // Fallback for empty generated slug
      } else {
        // User provided a concrete slug
        newSlugValue = updateData.slug;
      }
    } else if (updateData.name && updateData.name !== existingWebsite.name) {
      // Name changed, slug not provided, so regenerate slug
      newSlugValue = generateSlug(updateData.name) || `website-${id}-${Date.now()}`; // Fallback for empty generated slug
    }

    // If a new slug value was determined (either from input or generation)
    if (newSlugValue !== undefined) {
      if (typeof newSlugValue === 'string' && newSlugValue.trim() !== '') {
        const uniqueSlug = await ensureUniqueSlug(c.env.DB, newSlugValue, 'websites', 'slug', 'id', id);
        if (uniqueSlug !== existingWebsite.slug) {
          newSlugValue = uniqueSlug;
          slugNeedsDatabaseUpdate = true;
        }
      } else if (newSlugValue === null) {
        // User wants to set slug to null
        if (existingWebsite.slug !== null) {
          slugNeedsDatabaseUpdate = true;
          // newSlugValue is already null
        }
      } else {
        // Slug became empty string, treat as no change or invalid based on schema (schema implies slug can be null but not empty string if validated properly)
        // For safety, if it's an empty string and was not null, consider it a change to null if allowed, or ignore.
        // Assuming empty string slug is not desired, and it should become null if it was previously non-null.
        if (existingWebsite.slug !== null && newSlugValue.trim() === '') {
            newSlugValue = null; // Convert empty string to null
            slugNeedsDatabaseUpdate = true;
        }
      }
    }

    const setClauses: string[] = [];
    const bindings: any[] = [];
    let paramIndex = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (key === 'slug') return; // Handled separately by finalSlug
      if (value !== undefined) {
        const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        setClauses.push(`${toSnakeCase(key)} = ?${paramIndex++}`);
        bindings.push(value);
      }
    });

    // Add slug to update if it has effectively changed
    if (slugNeedsDatabaseUpdate) {
      setClauses.push(`slug = ?${paramIndex++}`);
      bindings.push(newSlugValue); // newSlugValue will be the unique string or null
    }

    if (setClauses.length === 0) {
      // No actual data fields to update (e.g., only slug was provided but it resulted in no change, or empty payload)
      // However, the initial check for Object.keys(updateData).length === 0 should catch empty payloads.
      // If slug was the only field and it didn't change, this path might be hit.
      return c.json(WebsiteUpdateResponseSchema.parse({ message: 'No effective changes to apply.' }), 200);
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`); // Always update timestamp

    bindings.push(id); // For the WHERE clause
    const stmt = c.env.DB.prepare(
      `UPDATE websites SET ${setClauses.join(', ')} WHERE id = ?${paramIndex}`
    ).bind(...bindings);

    const result = await stmt.run();

    if (result.success) {
        // D1's run() result for UPDATE doesn't directly confirm a row was changed if values were same.
        // It indicates the query executed. We assume success if no error.
        return c.json(WebsiteUpdateResponseSchema.parse({ message: 'Website updated successfully.' }), 200);
    } else {
      console.error('Failed to update website, D1 result:', result);
      return c.json(WebsiteUpdateFailedErrorSchema.parse({ message: 'Failed to update website.' }), 500);
    }

  } catch (error) {
    console.error('Error updating website:', error);
    return c.json(WebsiteUpdateFailedErrorSchema.parse({ message: 'Failed to update website.' }), 500);
  }
};
