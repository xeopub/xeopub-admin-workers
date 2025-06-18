import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  WebsiteSchema,
  GetWebsiteResponseSchema,
  WebsiteNotFoundErrorSchema
} from '../../schemas/websiteSchemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas';
import { z } from 'zod';

export const getWebsiteByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
        success: false,
        message: 'Invalid ID format.'
    }), 400);
  }

  const id = parseInt(paramValidation.data.id, 10);

  try {
    const websiteRaw = await c.env.DB.prepare(
      `SELECT 
        id, name, slug, description, slogan, custom_url,
        default_post_background_bucket_key, default_post_thumbnail_bucket_key,
        default_post_background_music_bucket_key, default_post_intro_music_bucket_key,
        first_comment_template,
        prompt_template_to_gen_evergreen_titles, prompt_template_to_gen_news_titles,
        prompt_template_to_gen_series_titles, prompt_template_to_gen_article_content,
        prompt_template_to_gen_article_metadata, prompt_template_to_gen_post_script,
        prompt_template_to_gen_post_background, prompt_template_to_gen_post_audio,
        prompt_template_to_gen_post_background_music, prompt_template_to_gen_post_intro_music,
        config, language_code,
        created_at, updated_at
      FROM websites WHERE id = ?1`
    ).bind(id).first<z.infer<typeof WebsiteSchema>>();

    if (!websiteRaw) {
      return c.json(WebsiteNotFoundErrorSchema.parse({
        success: false,
        message: 'Website not found.'
      }), 404);
    }
    
    const website = WebsiteSchema.parse(websiteRaw);

    return c.json(GetWebsiteResponseSchema.parse({
      success: true,
      website: website
    }), 200);

  } catch (error) {
    if (error instanceof z.ZodError) {
        console.error('Get website by ID validation error:', error.flatten());
        return c.json(GeneralServerErrorSchema.parse({
            success: false,
            message: 'Response validation failed for website data.'
        }), 500);
    }
    console.error('Error fetching website by ID:', error);
    return c.json(GeneralServerErrorSchema.parse({
        success: false,
        message: 'Failed to retrieve website.'
    }), 500);
  }
};
