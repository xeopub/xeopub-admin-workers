import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import { z } from 'zod';
import {
  ListWebsitesQuerySchema, // Added
  ListWebsitesResponseSchema,
  WebsiteSummarySchema,
  WebsiteSortBySchema, // Added for sorting
} from '../../schemas/website.schemas';
import { GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas'; // Added GeneralBadRequestErrorSchema

export const listWebsitesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListWebsitesQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ 
      message: 'Invalid query parameters.', 
      errors: queryParseResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { page, limit, name, languageCode, sortBy, sortOrder } = queryParseResult.data;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (name) {
    whereClauses.push(`LOWER(name) LIKE LOWER(?${paramIndex++})`);
    bindings.push(`%${name}%`);
  }
  if (languageCode) {
    whereClauses.push(`language_code = ?${paramIndex++}`);
    bindings.push(languageCode);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Whitelist of sortable columns and their actual DB names
  const validSortColumns: Record<z.infer<typeof WebsiteSortBySchema>, string> = {
    id: 'id',
    name: 'name',
    languageCode: 'language_code',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const orderByColumn = validSortColumns[sortBy] || 'name'; // Default to 'name'
  const orderByDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC

  const orderByString = `ORDER BY ${orderByColumn} ${orderByDirection}`;

  try {
    const websitesQuery = c.env.DB.prepare(
      `SELECT id, name, slug, domain, language_code FROM websites ${whereString} ${orderByString} LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`
    ).bind(...bindings, limit, offset);
    
    const countQuery = c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM websites ${whereString}`
    ).bind(...bindings);

    const [websitesDbResult, countResult] = await Promise.all([
      websitesQuery.all<any>(), 
      countQuery.first<{ total: number }>()
    ]);

    if (!websitesDbResult.results || countResult === null) {
        console.error('Failed to fetch websites or count, D1 results:', websitesDbResult, countResult);
        return c.json(GeneralServerErrorSchema.parse({ 
          message: 'Failed to retrieve websites from the database.'
        }), 500);
    }

    const keysToCamelCase = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(v => keysToCamelCase(v));
      }
      return Object.keys(obj).reduce((acc: any, key: string) => {
        const camelKey = key.replace(/_([a-z])/g, g => g[1].toUpperCase());
        acc[camelKey] = keysToCamelCase(obj[key]);
        return acc;
      }, {});
    };

    const websites = websitesDbResult.results ? websitesDbResult.results.map((row: any) => WebsiteSummarySchema.parse(keysToCamelCase(row))) : [];
    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      page,
      limit,
      totalItems,
      totalPages,
    };

    return c.json(ListWebsitesResponseSchema.parse({
      websites: websites,
      pagination: pagination,
    }), 200);

  } catch (error) {
    console.error('Error listing websites:', error);
    // Check if it's a ZodError for parsing individual website rows, though less likely here with WebsiteSummarySchema
    if (error instanceof z.ZodError) {
      console.error('Zod validation error during website processing:', error.flatten());
      return c.json(GeneralServerErrorSchema.parse({
        message: 'Error processing website data.'
      }), 500);
    }
    return c.json(GeneralServerErrorSchema.parse({
      message: 'Failed to retrieve websites.'
    }), 500);
  }
};
