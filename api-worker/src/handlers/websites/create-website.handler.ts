import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  WebsiteCreateRequestSchema,
  WebsiteNameExistsErrorSchema,
  WebsiteCreateFailedErrorSchema,
  WebsiteCreateResponseSchema
} from '../../schemas/website.schemas';
import { generateSlug, ensureUniqueSlug } from '../../utils/slugify';

export const createWebsiteHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(WebsiteCreateFailedErrorSchema.parse({
            message: 'Invalid JSON payload.'
    }), 400);
  }

  const validationResult = WebsiteCreateRequestSchema.safeParse(requestBody);

  if (!validationResult.success) {
    console.error('Create website validation error:', validationResult.error.flatten());
    return c.json(WebsiteCreateFailedErrorSchema.parse({
            message: 'Invalid input for creating website.',
      // errors: validationResult.error.flatten().fieldErrors // Optional: include detailed field errors
    }), 400);
  }

  const websiteData = validationResult.data;
  let slug = websiteData.slug;

  if (!slug || slug.startsWith('temp-slug-')) {
    const newSlug = generateSlug(websiteData.name);
    slug = newSlug || `website-${Date.now()}`; // Fallback if name results in an empty slug
  }

  try {
    // Ensure the slug is unique
    slug = await ensureUniqueSlug(c.env.DB, slug, 'websites');
    // Check if website name already exists
    const existingWebsiteByName = await c.env.DB.prepare(
      'SELECT id FROM websites WHERE name = ?1'
    ).bind(websiteData.name).first<{ id: number }>();

    if (existingWebsiteByName) {
      return c.json(WebsiteNameExistsErrorSchema.parse({
                message: 'Website name already exists.'
      }), 400);
    }

    // Insert new website
    const stmt = c.env.DB.prepare(
      `INSERT INTO websites (
        name, slug, description, slogan, custom_url,
        default_post_background_bucket_key, default_post_thumbnail_bucket_key,
        default_post_background_music_bucket_key, default_post_intro_music_bucket_key,
        first_comment_template,
        prompt_template_to_gen_evergreen_titles, prompt_template_to_gen_news_titles,
        prompt_template_to_gen_series_titles, prompt_template_to_gen_article_content,
        prompt_template_to_gen_article_metadata, prompt_template_to_gen_post_script,
        prompt_template_to_gen_post_background, prompt_template_to_gen_post_audio,
        prompt_template_to_gen_post_background_music, prompt_template_to_gen_post_intro_music,
        config, language_code
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)`
    ).bind(
      websiteData.name,                                  // 1
      slug,                                           // 2 (potentially modified)
      websiteData.description,                           // 3
      websiteData.slogan,                                // 4
      websiteData.customUrl,                            // 5
      websiteData.defaultPostBackgroundBucketKey, // 6
      websiteData.defaultPostThumbnailBucketKey,  // 7
      websiteData.defaultPostBackgroundMusicBucketKey, // 8
      websiteData.defaultPostIntroMusicBucketKey,    // 9
      websiteData.firstCommentTemplate,                // 10
      websiteData.promptTemplateToGenEvergreenTitles, // 11
      websiteData.promptTemplateToGenNewsTitles,    // 12
      websiteData.promptTemplateToGenSeriesTitles,  // 13
      websiteData.promptTemplateToGenArticleContent,// 14
      websiteData.promptTemplateToGenArticleMetadata, // 15
      websiteData.promptTemplateToGenPostScript, // 16
      websiteData.promptTemplateToGenPostBackground, // 17
      websiteData.promptTemplateToGenPostAudio,  // 18
      websiteData.promptTemplateToGenPostBackgroundMusic, // 19
      websiteData.promptTemplateToGenPostIntroMusic,    // 20
      websiteData.config,                                // 21
      websiteData.languageCode                          // 22
    );
    
    const result = await stmt.run();

    if (result.success && result.meta.last_row_id) {
      return c.json(WebsiteCreateResponseSchema.parse({
        
        message: 'Website created successfully.',
        id: result.meta.last_row_id
      }), 201);
    } else {
      console.error('Failed to insert website, D1 result:', result);
      return c.json(WebsiteCreateFailedErrorSchema.parse({
                message: 'Failed to create website.'
      }), 500);
    }

  } catch (error) {
    console.error('Error creating website:', error);
    // Check for specific D1 errors if possible, e.g., unique constraint violation if not caught above
    // For now, a general server error
    return c.json(WebsiteCreateFailedErrorSchema.parse({
                message: 'Failed to create website.'
    }), 500);
  }
};
