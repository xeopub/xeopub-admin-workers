import { Context } from 'hono';
import { hash } from 'bcryptjs';
import type { CloudflareEnv } from '../../env';
import {
  UserUpdateRequestSchema,
  UserUpdateResponseSchema,
  UserUpdateFailedErrorSchema,
  UserNotFoundErrorSchema,
  UserEmailExistsErrorSchema
} from '../../schemas/user.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';

export const updateUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());
  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
      message: 'Invalid ID format in path.',
      errors: paramValidation.error.flatten().fieldErrors,
    }), 400);
  }
  const { id } = paramValidation.data;

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(UserUpdateFailedErrorSchema.parse({ message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = UserUpdateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(UserUpdateFailedErrorSchema.parse({
      message: 'Invalid input for updating user.',
      errors: validationResult.error.flatten().fieldErrors,
    }), 400);
  }

  const { email, name, password, roleIds } = validationResult.data;

  const hasActualUpdate = name !== undefined || email !== undefined || password !== undefined || roleIds !== undefined;
  if (!hasActualUpdate) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'No update data provided.' }), 400);
  }

  try {
    const userToUpdate = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?1')
      .bind(id)
      .first<{ id: number; email: string }>();

    if (!userToUpdate) {
      return c.json(UserNotFoundErrorSchema.parse({ message: 'User not found.' }), 404);
    }

    if (email && email !== userToUpdate.email) {
      const existingUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND id != ?2').bind(email, id).first();
      if (existingUser) {
        return c.json(UserEmailExistsErrorSchema.parse({ message: 'This email is already in use by another user.', error: 'emailExists' }), 409);
      }
    }

    const batchStatements: D1PreparedStatement[] = [];

    // Prepare user fields update
    const userModelUpdateFields: string[] = [];
    const userModelBindings: (string | number | null)[] = [];
    let userModelBindingIndex = 1;

    if (name !== undefined) { userModelUpdateFields.push(`name = ?${userModelBindingIndex++}`); userModelBindings.push(name); }
    if (email !== undefined) { userModelUpdateFields.push(`email = ?${userModelBindingIndex++}`); userModelBindings.push(email); }
    if (password !== undefined) {
      const saltRounds = 12;
      const passwordHash = await hash(password, saltRounds);
      userModelUpdateFields.push(`password_hash = ?${userModelBindingIndex++}`);
      userModelBindings.push(passwordHash);
    }

    if (userModelUpdateFields.length > 0) {
      userModelUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
      const updateUserQuery = `UPDATE users SET ${userModelUpdateFields.join(', ')} WHERE id = ?${userModelBindingIndex}`;
      userModelBindings.push(id);
      batchStatements.push(c.env.DB.prepare(updateUserQuery).bind(...userModelBindings));
    }

    // Prepare roles update
    if (roleIds !== undefined) {
      if (roleIds.length > 0) {
        const placeholders = roleIds.map(() => '?').join(',');
        const existingRoles = await c.env.DB.prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`).bind(...roleIds).all<{id: number}>();
        if (existingRoles.results?.length !== roleIds.length) {
          const invalidRoleIds = roleIds.filter(rid => !existingRoles.results?.some((er: {id: number}) => er.id === rid));
          return c.json(GeneralBadRequestErrorSchema.parse({ message: `Invalid roleIds provided: ${invalidRoleIds.join(', ')}.` }), 400);
        }
      }
      
      batchStatements.push(c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?1').bind(id));
      if (roleIds.length > 0) {
        for (const roleId of roleIds) {
          batchStatements.push(c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?1, ?2)').bind(id, roleId));
        }
      }
    }

    if (batchStatements.length > 0) {
      await c.env.DB.batch(batchStatements);
    }

    return c.json(UserUpdateResponseSchema.parse({ message: 'User updated successfully.' }), 200);

  } catch (error: any) {
    console.error(`Error updating user ${id}:`, error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json(UserEmailExistsErrorSchema.parse({ message: 'This email is already in use by another user.', error: 'emailExists' }), 409);
    }
    return c.json(UserUpdateFailedErrorSchema.parse({ message: 'Failed to update user due to a server error.' }), 500);
  }
};
