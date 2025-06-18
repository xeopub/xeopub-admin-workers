import { Context } from 'hono';
import { hash } from 'bcryptjs';
import type { CloudflareEnv } from '../../env';
import {
  UserUpdateRequestSchema,
  UserUpdateResponseSchema,
  UserUpdateFailedErrorSchema,
  UserNotFoundErrorSchema,
  UserEmailExistsErrorSchema
} from '../../schemas/userSchemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

export const updateUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());
  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    return c.json(UserUpdateFailedErrorSchema.parse({ success: false, message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = UserUpdateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(UserUpdateFailedErrorSchema.parse({ 
        success: false, 
        message: 'Invalid input for updating user.',
        // errors: validationResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { email, name, password, role_ids } = validationResult.data;

  // Check if any updatable field (name, email, password, or role_ids) is present.
  // role_ids being an empty array is a valid update (remove all roles).
  const hasActualUpdate = name !== undefined || 
                          email !== undefined || 
                          password !== undefined || 
                          role_ids !== undefined;

  if (!hasActualUpdate) {
    return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'No update data provided.' }), 400);
  }

  // The old check: const hasActualUpdateFields = name !== undefined || 
                                email !== undefined || 
                                password !== undefined || 
                                role_ids !== undefined; // role_ids being an empty array is an intentional update

  try {
    // 1. Check if user exists
    const userToUpdate = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?1')
      .bind(id)
      .first<{ id: number; email: string }>();

    if (!userToUpdate) {
      return c.json(UserNotFoundErrorSchema.parse({ success: false, message: 'User not found.' }), 404);
    }

    // 2. If email is being changed, check if the new email already exists for another user
    if (email && email !== userToUpdate.email) {
      const existingUserWithNewEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND id != ?2')
        .bind(email, id)
        .first<{ id: number }>();
      if (existingUserWithNewEmail) {
        return c.json(UserEmailExistsErrorSchema.parse({ success: false, message: 'This email is already in use by another user.', error: 'email_exists' }), 400);
      }
    }

    // 3. Update user's own fields (name, email, password_hash)
    const userModelUpdateFields: string[] = [];
    const userModelBindings: (string | number | null)[] = [];
    let userModelBindingIndex = 1;

    if (name !== undefined) { userModelUpdateFields.push(`name = ?${userModelBindingIndex++}`); userModelBindings.push(name); }
    if (email !== undefined) { userModelUpdateFields.push(`email = ?${userModelBindingIndex++}`); userModelBindings.push(email); }
    if (password !== undefined) {
      const saltRounds = 12;
      const password_hash = await hash(password, saltRounds);
      userModelUpdateFields.push(`password_hash = ?${userModelBindingIndex++}`); 
      userModelBindings.push(password_hash); 
    }

    let userModelFieldsEffectivelyUpdated = false;

    if (userModelUpdateFields.length > 0) {
      userModelUpdateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      const updateUserQuery = `UPDATE users SET ${userModelUpdateFields.join(', ')} WHERE id = ?${userModelBindingIndex}`;
      userModelBindings.push(id);
      
      const stmt = c.env.DB.prepare(updateUserQuery).bind(...userModelBindings);
      const userUpdateResult = await stmt.run();

      if (userUpdateResult.success && userUpdateResult.meta.changes > 0) {
        userModelFieldsEffectivelyUpdated = true;
      } else if (!userUpdateResult.success) {
        console.error('Failed to update user model fields, D1 result:', userUpdateResult);
        return c.json(UserUpdateFailedErrorSchema.parse({ success: false, message: 'Failed to update user fields.' }), 500);
      }
      // If success but changes === 0, userModelFieldsEffectivelyUpdated remains false.
    }

    // 4. Handle role updates if role_ids is provided in the request
    let rolesWereManaged = false; // True if role_ids was in payload (even if empty array)

    if (role_ids !== undefined) {
      rolesWereManaged = true;

      // Validate role_ids if the array is not empty
      if (role_ids.length > 0) {
        const placeholders = role_ids.map(() => '?').join(',');
        const existingRolesStmt = c.env.DB.prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`);
        const existingRolesResult = await existingRolesStmt.bind(...role_ids).all<{id: number}>();
        if (!existingRolesResult.success || !existingRolesResult.results || existingRolesResult.results.length !== role_ids.length) {
          const validFoundIds = new Set(existingRolesResult.results?.map(r => r.id) || []);
          const invalidRoleIds = role_ids.filter(id => !validFoundIds.has(id));
          return c.json(GeneralBadRequestErrorSchema.parse({
              success: false,
              message: `Invalid role_ids provided for update: ${invalidRoleIds.join(', ')}. Please ensure all role IDs exist.`
          }), 400);
        }
      }

      // Delete existing roles for the user
      const deleteRolesStmt = c.env.DB.prepare('DELETE FROM user_roles WHERE user_id = ?1').bind(id);
      const deleteResult = await deleteRolesStmt.run();
      if (!deleteResult.success) {
        console.error(`Failed to delete existing roles for user ${id}. D1 result:`, deleteResult);
        // Continue, but roles might be in an inconsistent state
      }

      // Insert new roles if role_ids is not empty
      if (role_ids.length > 0) {
        const insertPromises = role_ids.map(roleId => {
          return c.env.DB.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?1, ?2)')
            .bind(id, roleId)
            .run();
        });
        const insertResults = await Promise.all(insertPromises);
        if (insertResults.some(res => !res.success)) {
          console.error(`One or more roles failed to be assigned to user ${id}. Results:`, insertResults);
          // Continue, but roles might be partially assigned
        }
      }
      // rolesWereManaged is already true if role_ids was defined.
    }

    // Determine final response
    if (userModelFieldsEffectivelyUpdated || rolesWereManaged) {
      return c.json(UserUpdateResponseSchema.parse({ success: true, message: 'User updated successfully.' }), 200);
    } else if (!userModelFieldsEffectivelyUpdated && !rolesWereManaged) {
       // This case should be caught by the initial `!hasActualUpdate` check if role_ids was the only field and was undefined.
       // If role_ids was provided (e.g. empty array) but no other fields, this means roles were processed.
       // If only user fields were provided but matched existing values, userFieldsUpdated would be false.
      return c.json(UserUpdateResponseSchema.parse({ success: true, message: 'No effective changes applied to the user.' }), 200);
    } else { // This 'else' corresponds to the `if (userModelFieldsEffectivelyUpdated || rolesWereManaged)` block
      // This path should ideally not be reached if the above logic is correct,
      // unless there was a D1 error in updating user fields that wasn't caught.
      // The original code had a path for result.success === false from user field update.
      // That is now handled inside the `if (updateFields.length > 1)` block.
      // This could be a D1 error or a unique constraint violation if not caught earlier (race condition for email)
      console.error('Failed to update user due to an unexpected issue after processing field and role updates.');
      return c.json(UserUpdateFailedErrorSchema.parse({ success: false, message: 'Failed to update user.' }), 500);
    }

  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error) {
        if (error.message.includes('UNIQUE constraint failed: users.email')) {
            return c.json(UserEmailExistsErrorSchema.parse({ success: false, message: 'This email is already in use by another user.', error: 'email_exists' }), 400);
        }
    }
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to update user due to a server error.' }), 500);
  }
};
