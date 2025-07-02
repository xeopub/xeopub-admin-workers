export function generateSlug(text: string): string {
  if (!text) {
    return '';
  }

  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Normalize to separate base characters and diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^a-z0-9-]/g, '') // Remove all non-alphanumeric characters except hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with a single hyphen
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

/**
 * Ensures that the given slug is unique in the specified table.
 * If the slug already exists, it appends a random number (1-999) to the initial slug
 * and checks again, repeating until a unique slug is found or max attempts are reached.
 * @param db The D1 database instance.
 * @param initialSlug The initial slug to check and make unique.
 * @param tableName The name of the table to check for slug uniqueness (e.g., 'websites', 'posts', 'series').
 * @param slugColumn The name of the slug column in the table (defaults to 'slug').
 * @param idColumn The name of the ID column in the table (defaults to 'id').
 * @param excludeId Optional. An ID to exclude from the uniqueness check (useful for update operations).
 * @returns A promise that resolves to a unique slug.
 */
export async function ensureUniqueSlug(
  db: D1Database,
  initialSlug: string,
  tableName: string,
  slugColumn: string = 'slug',
  idColumn: string = 'id',
  excludeId?: number | string,
  additionalConditions?: Record<string, any> // New parameter
): Promise<string> {
  let currentSlug = initialSlug;
  let attempt = 0;
  const MAX_ATTEMPTS = 10; // Safety break for an extremely unlikely scenario

  while (attempt < MAX_ATTEMPTS) {
    let query = `SELECT ${idColumn} FROM ${tableName} WHERE ${slugColumn} = ?1`;
    const params: (string | number | null)[] = [currentSlug];
    let paramIndex = 2;

    if (excludeId !== undefined) {
      query += ` AND ${idColumn} != ?${paramIndex++}`;
      params.push(excludeId);
    }

    // For tables with global unique slug constraints, ignore additionalConditions.
    const globallyUniqueSlugTables = ['websites', 'series', 'posts'];
    if (additionalConditions && !globallyUniqueSlugTables.includes(tableName)) {
      for (const [key, value] of Object.entries(additionalConditions)) {
        if (value === null) {
          query += ` AND ${key} IS NULL`;
        } else {
          query += ` AND ${key} = ?${paramIndex++}`;
          params.push(value);
        }
      }
    } else if (additionalConditions && globallyUniqueSlugTables.includes(tableName)) {
      // console.warn(`ensureUniqueSlug: Ignoring additionalConditions for table '${tableName}' due to global unique slug constraint.`);
    }

    const existing = await db.prepare(query).bind(...params).first<{ [key: string]: number | string }>();

    if (!existing) {
      return currentSlug; // Slug is unique
    }

    // Slug exists, generate a new one by appending a random number to the *initial* slug
    attempt++;
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    currentSlug = `${initialSlug}-${randomNumber}`;
  }

  // Fallback if a unique slug couldn't be found after MAX_ATTEMPTS
  // This is highly unlikely with 999 random options per attempt against the original slug
  console.warn(
    `Could not find a unique slug for "${initialSlug}" in table "${tableName}" after ${MAX_ATTEMPTS} attempts. Appending timestamp as a fallback.`
  );
  return `${initialSlug}-${Date.now()}`;
}
