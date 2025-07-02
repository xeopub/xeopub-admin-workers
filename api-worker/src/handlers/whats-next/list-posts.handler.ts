import { Context } from 'hono';
import { ZodError } from 'zod';
import type { CloudflareEnv } from '../../env';
import { WhatsNextResponseSchema } from '../../schemas/whats-next.schemas';
import { GeneralServerErrorSchema } from '../../schemas/common.schemas';

// A type representing the raw database result for an post with all required fields
type DbPost = {
  id: number;
  title: string;
  slug: string;
  status: string;
  website_id: number;
  series_id: number | null;
  website_name: string | null;
  series_name: string | null;
  thumbnail_gen_prompt: string | null;
  article_image_gen_prompt: string | null;
  scheduled_publish_at: string | null;
  freeze_status: number; // SQLite returns 0 or 1 for BOOLEAN
  last_status_change_at: string;
  updated_at: string;
  created_at: string;
};

// Safely parses a D1 date string and converts it to an ISO string.
const safeToISOString = (dateString: string | null | undefined): string | null => {
  if (!dateString) {
    return null;
  }
  // D1 returns dates as 'YYYY-MM-DD HH:MM:SS'. Replace space with 'T' and add 'Z' for UTC.
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  // Check if the created date is valid.
  if (isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

// Maps a raw database post object to the camelCase schema
const mapToCamelCase = (dbPost: DbPost) => ({
  id: dbPost.id,
  title: dbPost.title,
  slug: dbPost.slug,
  status: dbPost.status,
  websiteId: dbPost.website_id,
  seriesId: dbPost.series_id,
  websiteName: dbPost.website_name,
  seriesName: dbPost.series_name,
  thumbnailGenPrompt: dbPost.thumbnail_gen_prompt,
  articleImageGenPrompt: dbPost.article_image_gen_prompt,
  scheduledPublishAt: safeToISOString(dbPost.scheduled_publish_at),
  freezeStatus: Boolean(dbPost.freeze_status),
  lastStatusChangeAt: safeToISOString(dbPost.last_status_change_at) ?? new Date().toISOString(),
  updatedAt: safeToISOString(dbPost.updated_at) ?? new Date().toISOString(),
  createdAt: safeToISOString(dbPost.created_at) ?? new Date().toISOString(),
});

const POST_COLUMNS = `
  e.id, e.title, e.slug, e.status, e.website_id, e.series_id,
  e.thumbnail_gen_prompt, e.article_image_gen_prompt, e.scheduled_publish_at,
  e.freeze_status, e.last_status_change_at, e.updated_at, e.created_at,
  s.name as website_name,
  se.title as series_name
`;

// Fetches posts for a specific status and optional extra conditions
const fetchPostsByStatus = async (db: D1Database, status: string, extraWhere: string = '') => {
  const query = `
    SELECT ${POST_COLUMNS}
    FROM posts e
    INNER JOIN websites s ON e.website_id = s.id
    LEFT JOIN series se ON e.series_id = se.id
    WHERE e.status = ?1 ${extraWhere}
    ORDER BY e.updated_at DESC;
  `;
  const { results } = await db.prepare(query).bind(status).all<DbPost>();
  return (results || []).map(mapToCamelCase);
};

// Fetches counts for the 'Waiting & Generating' section
const fetchWaitingAndGenerating = async (db: D1Database) => {
  const query = `
    SELECT
      SUM(CASE WHEN status = 'materialGenerated' THEN 1 ELSE 0 END) as materialGenerated,
      SUM(CASE WHEN status = 'generatingVideo' THEN 1 ELSE 0 END) as generatingVideo,
      SUM(CASE WHEN status = 'videoGenerated' AND status_on_youtube = 'none' AND status_on_x = 'none' AND status_on_website = 'none' THEN 1 ELSE 0 END) as generatedNotPublished
    FROM posts;
  `;
  const result = await db.prepare(query).first<{ materialGenerated: number; generatingVideo: number; generatedNotPublished: number; }>();
  return {
    materialGenerated: result?.materialGenerated || 0,
    generatingVideo: result?.generatingVideo || 0,
    generatedNotPublished: result?.generatedNotPublished || 0,
  };
};

// Fetches and groups posts for the 'To Research' section
const fetchToResearch = async (db: D1Database) => {
  const query = `
    WITH RankedPosts AS (
      SELECT
        ${POST_COLUMNS},
        ROW_NUMBER() OVER(PARTITION BY e.series_id ORDER BY e.created_at DESC) as rn,
        COUNT(*) OVER(PARTITION BY e.series_id) as total_drafts
      FROM posts e
      INNER JOIN series se ON e.series_id = se.id
      INNER JOIN websites s ON e.website_id = s.id
      WHERE e.status = 'draft' AND e.series_id IS NOT NULL
    )
    SELECT * FROM RankedPosts WHERE rn <= 3;
  `;
  const { results } = await db.prepare(query).all<DbPost & { total_drafts: number }>();
  if (!results) return [];

  // Group posts by series
  const seriesMap = new Map();
  for (const row of results) {
    if (!seriesMap.has(row.series_id)) {
      seriesMap.set(row.series_id, {
        seriesId: row.series_id,
        seriesName: row.series_name,
        websiteId: row.website_id,
        websiteName: row.website_name,
        posts: [],
      });
    }
    seriesMap.get(row.series_id).posts.push(mapToCamelCase(row));
  }
  return Array.from(seriesMap.values());
};

export const listWhatsNextPosts = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  try {
    const db = c.env.DB;

    const [toGenerateMaterial, waitingAndGenerating, toPublishOnYouTube, toPublishOnX, toResearch] = await Promise.all([
      fetchPostsByStatus(db, 'researched'),
      fetchWaitingAndGenerating(db),
      fetchPostsByStatus(db, 'videoGenerated', "AND e.status_on_youtube = 'none'"),
      fetchPostsByStatus(db, 'videoGenerated', "AND e.status_on_x = 'none' AND e.status_on_youtube = 'public'"),
      fetchToResearch(db),
    ]);

    const response = WhatsNextResponseSchema.parse({
      toGenerateMaterial: { posts: toGenerateMaterial },
      waitingAndGenerating: waitingAndGenerating,
      toPublishOnYouTube: { posts: toPublishOnYouTube },
      toPublishOnX: { posts: toPublishOnX },
      toResearch: { series: toResearch },
    });

    return c.json(response, 200);
  } catch (e) {
    if (e instanceof ZodError) {
      console.error('Zod validation error:', JSON.stringify(e.issues, null, 2));
    }
    console.error("Error fetching what's next posts:", e);
    const error = GeneralServerErrorSchema.parse({
      message: "Failed to fetch what's next posts",
      stack: c.env.ENVIRONMENT === 'development' ? (e as Error).stack : undefined,
    });
    return c.json(error, 500);
  }
};