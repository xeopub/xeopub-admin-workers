import { Context } from 'hono';
import { z } from 'zod';
import type { CloudflareEnv } from '../../env';
import {
  UserSchema,
  ListUsersResponseSchema,
  ListUsersQuerySchema, // Added import for query schema
  UserSortBySchema, // Added for sorting
} from '../../schemas/user.schemas';
import { GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

interface UserWithRoleFromDB {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  role_id: number | null;
  role_name: string | null;
}

export const listUsersHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListUsersQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
      message: 'Invalid query parameters.',
      errors: queryParseResult.error.flatten().fieldErrors // Provide error details
    }), 400);
  }

  const { page, limit, name, email, sortBy, sortOrder } = queryParseResult.data;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (name) {
    whereClauses.push(`LOWER(u.name) LIKE LOWER(?${paramIndex++})`);
    bindings.push(`%${name}%`);
  }
  if (email) {
    whereClauses.push(`LOWER(u.email) LIKE LOWER(?${paramIndex++})`);
    bindings.push(`%${email}%`);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Whitelist of sortable columns and their actual DB names
  const validSortColumns: Record<z.infer<typeof UserSortBySchema>, string> = {
    id: 'u.id',
    name: 'u.name',
    email: 'u.email',
    createdAt: 'u.created_at',
    updatedAt: 'u.updated_at',
  };

  const orderByColumn = validSortColumns[sortBy] || 'u.name'; // Default to 'u.name'
  const orderByDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC

  const orderByString = `ORDER BY ${orderByColumn} ${orderByDirection}, r.id ASC`;

  try {
    const usersQueryStmt = `
      SELECT
        u.id, u.email, u.name, u.password_hash, u.created_at, u.updated_at,
        r.id as role_id, r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ${whereString}
      ${orderByString}
      LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}
    `;

    const countQueryStmt = `SELECT COUNT(DISTINCT u.id) as total FROM users u ${whereString}`;

    const usersDbQuery = c.env.DB.prepare(usersQueryStmt).bind(...bindings, limit, offset);
    const countQuery = c.env.DB.prepare(countQueryStmt).bind(...bindings);

    const [usersDbResult, countResult] = await Promise.all([
      usersDbQuery.all<UserWithRoleFromDB>(),
      countQuery.first<{ total: number }>()
    ]);

    if (!usersDbResult.success || !usersDbResult.results || countResult === null) {
      console.error('Failed to fetch users or count from database:', usersDbResult?.error, countResult);
      return c.json(GeneralServerErrorSchema.parse({
        message: 'Failed to retrieve users from the database.'
      }), 500);
    }

    const usersMap = new Map<number, z.input<typeof UserSchema>>();
    for (const row of usersDbResult.results) {
      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          email: row.email,
          name: row.name,
          password_hash: row.password_hash,
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
          roles: [],
        });
      }
      if (row.role_id && row.role_name) {
        usersMap.get(row.id)!.roles!.push({ id: row.role_id, name: row.role_name });
      }
    }

    const allUsersWithRoles = Array.from(usersMap.values());

    const validatedUsers = z.array(UserSchema).safeParse(allUsersWithRoles);

    if (!validatedUsers.success) {
      console.error('Error validating final user list structure:', validatedUsers.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({
        message: 'Error validating final user list structure.'
      }), 500);
    }

    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    return c.json(ListUsersResponseSchema.parse({
      users: validatedUsers.data,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    }), 200);

  } catch (error) {
    console.error('Error listing users:', error);
    return c.json(GeneralServerErrorSchema.parse({
      message: 'Failed to list users due to a server error.'
    }), 500);
  }
};
