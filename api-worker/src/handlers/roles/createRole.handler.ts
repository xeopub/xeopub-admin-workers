import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  RoleCreateRequestSchema,
  RoleCreateResponseSchema,
  RoleNameExistsErrorSchema,
  RoleCreateFailedErrorSchema
} from '../../schemas/roleSchemas';

export const createRoleHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch (error) {
    return c.json(RoleCreateFailedErrorSchema.parse({ success: false, message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = RoleCreateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(RoleCreateFailedErrorSchema.parse({ 
        success: false, 
        message: 'Invalid input for creating role.',
        // errors: validationResult.error.flatten().fieldErrors // Optional for more detailed errors
    }), 400);
  }

  const { name, description, permissions } = validationResult.data;

  try {
    // Check if role name already exists
    const existingRole = await c.env.DB.prepare('SELECT id FROM roles WHERE name = ?1')
      .bind(name)
      .first<{ id: number }>();

    if (existingRole) {
      return c.json(RoleNameExistsErrorSchema.parse({ success: false, message: 'Role name already exists.' }), 400);
    }

    const permissionsJson = JSON.stringify(permissions);

    const stmt = c.env.DB.prepare(
      'INSERT INTO roles (name, description, permissions) VALUES (?1, ?2, ?3)'
    ).bind(name, description, permissionsJson);
    
    const result = await stmt.run();

    if (result.success && result.meta.last_row_id) {
      return c.json(RoleCreateResponseSchema.parse({
        success: true,
        message: 'Role created successfully.',
        roleId: result.meta.last_row_id
      }), 201);
    } else {
      console.error('Failed to insert role, D1 result:', result);
      return c.json(RoleCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create role.' }), 500);
    }

  } catch (error) {
    console.error('Error creating role:', error);
    return c.json(RoleCreateFailedErrorSchema.parse({ success: false, message: 'Failed to create role due to a server error.' }), 500);
  }
};
