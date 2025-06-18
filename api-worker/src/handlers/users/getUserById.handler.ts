import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  UserSchema,
  GetUserResponseSchema,
  UserNotFoundErrorSchema
} from '../../schemas/userSchemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';
import { z } from 'zod';
import { D1Result } from '@cloudflare/workers-types';

interface UserWithRoleFromDB {
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
  role_id: number | null;
  role_name: string | null;
}

interface UserFromDB { // This interface might still be used if other parts of the code expect it, or can be removed if not.
  id: number;
  email: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export const getUserByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    const dbResults: D1Result<UserWithRoleFromDB> = await c.env.DB.prepare(
      `SELECT
         u.id, u.email, u.name, u.created_at, u.updated_at,
         r.id as role_id, r.name as role_name
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ?1`
    ).bind(id).all<UserWithRoleFromDB>();

    if (!dbResults.success || !dbResults.results || dbResults.results.length === 0) {
      return c.json(UserNotFoundErrorSchema.parse({ success: false, message: 'User not found.' }), 404);
    }

    const firstRow = dbResults.results[0];
    const roles = dbResults.results
      .filter(row => row.role_id !== null && row.role_name !== null)
      .map(row => ({
        id: row.role_id!,
        name: row.role_name!,
      }));

    const userForValidation: z.input<typeof UserSchema> = {
      id: firstRow.id,
      email: firstRow.email,
      name: firstRow.name,
      created_at: new Date(firstRow.created_at), // Zod will coerce to Date
      updated_at: new Date(firstRow.updated_at), // Zod will coerce to Date
      roles: roles.length > 0 ? roles : [], // Ensure roles is an array, even if empty
    };

    const validation = UserSchema.safeParse(userForValidation);
    if (!validation.success) {
      console.error(`Data for user ID ${firstRow.id} failed UserSchema validation after DB fetch:`, validation.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Error processing user data.' }), 500);
    }

    return c.json(GetUserResponseSchema.parse({ success: true, user: validation.data }), 200);

  } catch (error) {
    console.error('Error getting user by ID:', error);
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to retrieve user due to a server error.' }), 500);
  }
};
