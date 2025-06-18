import { Context } from 'hono';
import { hash } from 'bcryptjs';
import type { CloudflareEnv } from '../../env';
import {
  UserCreateRequestSchema,
  UserCreateResponseSchema,
  UserCreateFailedErrorSchema,
  UserEmailExistsErrorSchema
} from '../../schemas/userSchemas';
import { GeneralBadRequestErrorSchema } from '../../schemas/commonSchemas'; // For role not found

export const createUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    return c.json(UserCreateFailedErrorSchema.parse({ success: false, message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = UserCreateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(UserCreateFailedErrorSchema.parse({ 
        success: false, 
        message: 'Invalid input for creating user.',
        // errors: validationResult.error.flatten().fieldErrors 
    }), 400);
  }

  const { email, name, password, role_ids } = validationResult.data;

  try {
    // 0. Validate role_ids if provided
    const rolesToAssignIds = (role_ids && role_ids.length > 0) ? role_ids : [2]; // Default to editor role (ID 2)

    if (role_ids && role_ids.length > 0) { // Only validate if roles were explicitly provided
      const placeholders = role_ids.map(() => '?').join(',');
      const existingRolesStmt = c.env.DB.prepare(`SELECT id FROM roles WHERE id IN (${placeholders})`);
      const existingRolesResult = await existingRolesStmt.bind(...role_ids).all<{id: number}>();
      
      if (!existingRolesResult.success || !existingRolesResult.results || existingRolesResult.results.length !== role_ids.length) {
        // Find which roles are invalid for a more specific error message (optional)
        const validFoundIds = new Set(existingRolesResult.results?.map(r => r.id) || []);
        const invalidRoleIds = role_ids.filter(id => !validFoundIds.has(id));
        return c.json(GeneralBadRequestErrorSchema.parse({
            success: false,
            message: `Invalid role_ids provided: ${invalidRoleIds.join(', ')}. Please ensure all role IDs exist.`
        }), 400);
      }
      // At this point, all provided role_ids are valid and are in rolesToAssignIds
    }
    // If no role_ids were provided, rolesToAssignIds defaults to [2] (editor), which is assumed to exist.

    // 1. Check if email already exists
    const existingUserByEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1')
      .bind(email)
      .first<{ id: number }>();

    if (existingUserByEmail) {
      return c.json(UserEmailExistsErrorSchema.parse({ success: false, message: 'A user with this email already exists.', error: 'email_exists' }), 400);
    }

    // 3. Hash password securely.
    const saltRounds = 12;
    const password_hash = await hash(password, saltRounds); 

    // 3. Store user in the database
    const stmt = c.env.DB.prepare(
      'INSERT INTO users (email, name, password_hash) VALUES (?1, ?2, ?3)'
    ).bind(email, name, password_hash);
    
    const result = await stmt.run();

    if (result.success && result.meta.last_row_id) {
      const newUserId = result.meta.last_row_id;
      // rolesToAssignIds is already defined and validated (or defaulted) from above

      try {
        for (const roleId of rolesToAssignIds) {
          const userRoleStmt = c.env.DB.prepare(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?1, ?2)'
          ).bind(newUserId, roleId);
          const userRoleResult = await userRoleStmt.run();

          if (!userRoleResult.success) {
            console.error(`Failed to assign role ID ${roleId} to user ${newUserId}. D1 user_roles insert result:`, userRoleResult);
            // Potentially collect errors and report them, or decide if one failure means the whole operation failed.
          }
        }
      } catch (roleError) {
        console.error(`Error assigning roles to user ${newUserId}:`, roleError);
        // Log and proceed as user creation was successful, roles might be partially assigned.
      }

      return c.json(UserCreateResponseSchema.parse({
        success: true,
        message: 'User created successfully.',
        id: result.meta.last_row_id
      }), 201);
    } else {
      console.error('Failed to insert user, D1 result:', result);
      // This could be a D1 error or the unique constraint on email if not caught above (race condition)
      return c.json(UserCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create user.' }), 500);
    }

  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error) {
        if (error.message.includes('UNIQUE constraint failed: users.email')) {
            return c.json(UserEmailExistsErrorSchema.parse({ success: false, message: 'A user with this email already exists.', error: 'email_exists' }), 400);
        }

    }
    return c.json(UserCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create user due to a server error.' }), 500);
  }
};
