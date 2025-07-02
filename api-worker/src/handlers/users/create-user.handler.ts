import { Context } from 'hono';
import { hash } from 'bcryptjs';
import type { CloudflareEnv } from '../../env';
import {
  UserCreateRequestSchema,
  UserCreateResponseSchema,
  UserCreateFailedErrorSchema,
  UserEmailExistsErrorSchema
} from '../../schemas/user.schemas';
import { GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas'; // For role not found

export const createUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(UserCreateFailedErrorSchema.parse({ message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = UserCreateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(UserCreateFailedErrorSchema.parse({
      message: 'Invalid input for creating user.',
      errors: validationResult.error.flatten().fieldErrors,
    }), 400);
  }

  const { email, name, password, roleIds } = validationResult.data;

  try {
    // Validate roleIds if provided
    const rolesToAssignIds = (roleIds && roleIds.length > 0) ? roleIds : [2]; // Default to editor role (ID 2)

    if (roleIds && roleIds.length > 0) { // Only validate if roles were explicitly provided
      const placeholders = roleIds.map(() => '?').join(',');
      const existingRolesStmt = c.env.DB.prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`);
      const existingRolesResult = await existingRolesStmt.bind(...roleIds).all<{id: number}>();
      
      if (!existingRolesResult.success || !existingRolesResult.results || existingRolesResult.results.length !== roleIds.length) {
        const validFoundIds = new Set(existingRolesResult.results?.map((r: { id: number }) => r.id) || []);
        const invalidRoleIds = roleIds.filter((id: number) => !validFoundIds.has(id));
        return c.json(GeneralBadRequestErrorSchema.parse({
          message: `Invalid roleIds provided: ${invalidRoleIds.join(', ')}. Please ensure all role IDs exist.`,
        }), 400);
      }
    }

    // Check if email already exists
    const existingUserByEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1')
      .bind(email)
      .first<{ id: number }>();

    if (existingUserByEmail) {
      return c.json(UserEmailExistsErrorSchema.parse({ message: 'A user with this email already exists.', error: 'emailExists' }), 409);
    }

    // Hash password securely
    const saltRounds = 12;
    const passwordHash = await hash(password, saltRounds);

    // Store user in the database
    const stmt = c.env.DB.prepare(
      'INSERT INTO users (email, name, password_hash) VALUES (?1, ?2, ?3)'
    ).bind(email, name, passwordHash);
    
    const result = await stmt.run();

    if (result.success && result.meta.last_row_id) {
      const newUserId = result.meta.last_row_id;

      try {
        for (const roleId of rolesToAssignIds) {
          const userRoleStmt = c.env.DB.prepare(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?1, ?2)'
          ).bind(newUserId, roleId);
          await userRoleStmt.run();
        }
      } catch (roleError) {
        console.error(`Error assigning roles to user ${newUserId}:`, roleError);
      }

      return c.json(UserCreateResponseSchema.parse({
        message: 'User created successfully.',
        id: newUserId,
      }), 201);
    } else {
      console.error(`Failed to insert user ${email}, D1 result:`, result);
      if (result.error?.includes('UNIQUE constraint failed')) {
        return c.json(UserEmailExistsErrorSchema.parse({ message: 'A user with this email already exists.', error: 'emailExists' }), 409);
      }
      return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to create user due to a database error.' }), 500);
    }
  } catch (error: any) {
    console.error(`Error creating user ${email}:`, error);
    return c.json(GeneralServerErrorSchema.parse({ message: 'An unexpected server error occurred.' }), 500);
  }
};
