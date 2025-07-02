import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  WebsiteSchema,
  GetWebsiteResponseSchema,
  WebsiteNotFoundErrorSchema
} from '../../schemas/website.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';
import { z } from 'zod';

export const getWebsiteByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
                message: 'Invalid ID format.'
    }), 400);
  }

  const id = parseInt(paramValidation.data.id, 10);

  try {
    const websiteRaw = await c.env.DB.prepare(
      `SELECT 
        id, name, slug, description, slogan, domain,
        prompt_template_to_gen_evergreen_titles, prompt_template_to_gen_news_titles,
        prompt_template_to_gen_series_titles, prompt_template_to_gen_post_content,
        prompt_template_to_enrich_post_content, prompt_template_to_gen_post_metadata,
        builder, git_repo_owner, git_repo_name, git_repo_branch, git_api_token,
        config, language_code,
        created_at, updated_at
      FROM websites WHERE id = ?1`
    ).bind(id).first<z.infer<typeof WebsiteSchema>>();

    if (!websiteRaw) {
      return c.json(WebsiteNotFoundErrorSchema.parse({
                message: 'Website not found.'
      }), 404);
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

    const websiteCamelCase = keysToCamelCase(websiteRaw);
    const website = WebsiteSchema.parse(websiteCamelCase);

    return c.json(GetWebsiteResponseSchema.parse({
      website: website
    }), 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Get website by ID validation error:', error.flatten());
        return c.json(GeneralServerErrorSchema.parse({
                        message: 'Response validation failed for website data.'
        }), 500);
    }
    console.error('Error fetching website by ID:', error);
    return c.json(GeneralServerErrorSchema.parse({
                message: 'Failed to retrieve website.'
    }), 500);
  }
};
