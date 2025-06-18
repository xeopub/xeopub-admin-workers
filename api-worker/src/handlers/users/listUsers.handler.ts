import { Context } from 'hono';
import { z } from 'zod';
import type { CloudflareEnv } from '../../env';
import {
  UserSchema,
  ListUsersResponseSchema
} from '../../schemas/userSchemas';
import { GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

// Schema for query parameters
import { D1Result } from '@cloudflare/workers-types';

const ListUsersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().default(1)).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive().max(100).default(10)).optional(),
});

interface UserWithRoleFromDB {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  role_id: number | null;
  role_name: string | null;
}

// Keep UserFromDB if it's used elsewhere, or remove if it becomes unused.
interface UserFromDB {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const listUsersHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListUsersQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ 
        success: false, 
        message: 'Invalid query parameters.',
        // errors: queryParseResult.error.flatten().fieldErrors
    }), 400);
  }

  const { page = 1, limit = 10 } = queryParseResult.data;
  const offset = (page - 1) * limit;

  try {
    const query = `
      SELECT
        u.id, u.email, u.name, u.created_at, u.updated_at,
        r.id as role_id, r.name as role_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      ORDER BY u.id ASC, r.id ASC
    `;

    const dbResponse: D1Result<UserWithRoleFromDB> = await c.env.DB.prepare(query).all<UserWithRoleFromDB>();

    if (!dbResponse.success || !dbResponse.results) {
      console.error('Failed to fetch users from database or no results:', dbResponse.error);
      return c.json(ListUsersResponseSchema.parse({ success: true, users: [] }), 200);
    }

    const usersMap = new Map<number, z.input<typeof UserSchema>>();

    for (const row of dbResponse.results) {
      if (!usersMap.has(row.id)) {
        usersMap.set(row.id, {
          id: row.id,
          email: row.email,
          name: row.name,
          created_at: new Date(row.created_at),
          updated_at: new Date(row.updated_at),
          roles: [],
        });
      }

      if (row.role_id && row.role_name) {
        const user = usersMap.get(row.id)!;
        // Ensure roles array exists, though it's initialized above
        if (!user.roles) {
            user.roles = [];
        }
        user.roles.push({ id: row.role_id, name: row.role_name });
      }
    }

    const allUsersWithRoles = Array.from(usersMap.values());

    // Apply pagination
    const paginatedUsersData = allUsersWithRoles.slice(offset, offset + limit);

    const validatedUsers = paginatedUsersData.map(user => {
      const validation = UserSchema.safeParse(user);
      if (!validation.success) {
        console.warn(`Data for user ID ${user.id} failed UserSchema validation:`, validation.error.flatten());
        return null;
      }
      return validation.data;
    }).filter(u => u !== null) as z.infer<typeof UserSchema>[];

    return c.json(ListUsersResponseSchema.parse({ success: true, users: validatedUsers }), 200);
    // TODO: Add total count for pagination if ListUsersResponseSchema is updated

  } catch (error) {
    console.error('Error listing users:', error);
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to list users due to a server error.' }), 500);
  }
};
