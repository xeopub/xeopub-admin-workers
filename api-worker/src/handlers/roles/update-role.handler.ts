import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  RoleUpdateRequestSchema,
  RoleUpdateResponseSchema,
  RoleNotFoundErrorSchema,
  RoleNameExistsErrorSchema,
  RoleUpdateFailedErrorSchema
} from '../../schemas/role.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';

interface RoleFromDB {
  id: number;
  name: string;
}

export const updateRoleHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());
  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  let requestBody;
  try {
    requestBody = await c.req.json();
  } catch {
    return c.json(RoleUpdateFailedErrorSchema.parse({ message: 'Invalid JSON payload.' }), 400);
  }

  const validationResult = RoleUpdateRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return c.json(RoleUpdateFailedErrorSchema.parse({ 
        
        message: 'Invalid input for updating role.',
        // errors: validationResult.error.flatten().fieldErrors 
    }), 400);
  }

  const updateData = validationResult.data;

  // If updateData is empty, no changes to make.
  if (Object.keys(updateData).length === 0) {
    return c.json(RoleUpdateResponseSchema.parse({ message: 'Role updated successfully.' }), 200);
  }

  try {
    // Check if role exists
    const currentRole = await c.env.DB.prepare('SELECT id, name FROM roles WHERE id = ?1')
      .bind(id)
      .first<RoleFromDB>();

    if (!currentRole) {
      return c.json(RoleNotFoundErrorSchema.parse({ message: 'Role not found.' }), 404);
    }

    // If name is being updated, check for uniqueness
    if (updateData.name && updateData.name !== currentRole.name) {
      const existingRoleWithNewName = await c.env.DB.prepare('SELECT id FROM roles WHERE name = ?1 AND id != ?2')
        .bind(updateData.name, id)
        .first<{ id: number }>();
      if (existingRoleWithNewName) {
        return c.json(RoleNameExistsErrorSchema.parse({ message: 'Role name already exists.' }), 400);
      }
    }

    const fieldsToUpdate: string[] = [];
    const valuesToBind: (string | null)[] = [];
    let bindIndex = 1;

    if (updateData.name !== undefined) {
      fieldsToUpdate.push(`name = ?${bindIndex}`);
      valuesToBind.push(updateData.name);
      bindIndex++;
    }
    if (updateData.description !== undefined) {
      fieldsToUpdate.push(`description = ?${bindIndex}`);
      valuesToBind.push(updateData.description); // updateData.description will be a string if present
      bindIndex++;
    }
    if (updateData.permissions !== undefined) {
      fieldsToUpdate.push(`permissions = ?${bindIndex}`);
      valuesToBind.push(JSON.stringify(updateData.permissions));
      bindIndex++;
    }

    // If, after checks, there are no actual fields to update (e.g. name was same as current)
    // This can happen if the only field provided was 'name' but it matched currentRole.name
    if (fieldsToUpdate.length === 0) {
        return c.json(RoleUpdateResponseSchema.parse({ message: 'Role updated successfully.' }), 200);
    }

    valuesToBind.push(id.toString()); // For the WHERE clause (D1 expects all bind params as strings or compatible)
    const query = `UPDATE roles SET ${fieldsToUpdate.join(', ')} WHERE id = ?${bindIndex}`;
    
    const stmt = c.env.DB.prepare(query).bind(...valuesToBind);
    const result = await stmt.run();

    if (result.success) {
      // D1 .run() for UPDATE returns meta.changes for rows changed.
      // If meta.changes is 0, it might mean the data provided was identical to existing data for the matched row.
      // This is still considered a successful update operation.
      return c.json(RoleUpdateResponseSchema.parse({ message: 'Role updated successfully.' }), 200);
    } else {
      console.error('Failed to update role, D1 result:', result);
      return c.json(RoleUpdateFailedErrorSchema.parse({ message: 'Failed to update role.' }), 500);
    }

  } catch (error) {
    console.error('Error updating role:', error);
    return c.json(RoleUpdateFailedErrorSchema.parse({ message: 'Failed to update role due to a server error.' }), 500);
  }
};
