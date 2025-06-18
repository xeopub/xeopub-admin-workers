import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import { z } from 'zod';
import {
  ListWebsitesResponseSchema,
  WebsiteSummarySchema
} from '../../schemas/websiteSchemas';
import { GeneralServerErrorSchema } from '../../schemas/commonSchemas';

export const listWebsitesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, language_code, slug FROM websites ORDER BY id ASC'
    ).all<z.infer<typeof WebsiteSummarySchema>>();

    const websites = results ? results.map(row => WebsiteSummarySchema.parse(row)) : [];

    return c.json(ListWebsitesResponseSchema.parse({
      success: true,
      websites: websites
    }), 200);

  } catch (error) {
    console.error('Error listing websites:', error);
    return c.json(GeneralServerErrorSchema.parse({
        success: false,
        message: 'Failed to retrieve websites.'
    }), 500);
  }
};
