import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  UserSchema,
  GetUserResponseSchema,
  UserNotFoundErrorSchema
} from '../../schemas/user.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';
import { z } from 'zod';

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

export const getUserByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
      message: 'Invalid ID format in path.',
      errors: paramValidation.error.flatten().fieldErrors,
    }), 400);
  }
  const { id } = paramValidation.data;

  try {
    const dbResults = await c.env.DB.prepare(
      `SELECT
         u.id, u.email, u.name, u.password_hash, u.created_at, u.updated_at,
         r.id as role_id, r.name as role_name
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ?1`
    ).bind(id).all<UserWithRoleFromDB>();

    if (!dbResults.success || !dbResults.results || dbResults.results.length === 0) {
      return c.json(UserNotFoundErrorSchema.parse({ message: 'User not found.' }), 404);
    }

    const firstRow = dbResults.results[0];
    const roles = dbResults.results
      .filter((row: UserWithRoleFromDB) => row.role_id !== null && row.role_name !== null)
      .map((row: UserWithRoleFromDB) => ({
        id: row.role_id!,
        name: row.role_name!,
      }));

    const userForValidation: z.input<typeof UserSchema> = {
      id: firstRow.id,
      email: firstRow.email,
      name: firstRow.name,
      password_hash: firstRow.password_hash,
      createdAt: new Date(firstRow.created_at),
      updatedAt: new Date(firstRow.updated_at),
      roles: roles.length > 0 ? roles : [],
    };

    const validation = UserSchema.safeParse(userForValidation);
    if (!validation.success) {
      console.error(`Data for user ID ${id} failed UserSchema validation after DB fetch:`, validation.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing user data.' }), 500);
    }

    return c.json(GetUserResponseSchema.parse({ user: validation.data }), 200);

  } catch (error) {
    console.error(`Error getting user by ID ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to retrieve user due to a server error.' }), 500);
  }
};
