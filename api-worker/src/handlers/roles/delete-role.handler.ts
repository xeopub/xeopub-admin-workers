import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  RoleDeleteResponseSchema,
  RoleNotFoundErrorSchema,
  RoleDeleteFailedErrorSchema
} from '../../schemas/role.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';

export const deleteRoleHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    // 1. Check if the role exists
    const roleExists = await c.env.DB.prepare('SELECT id FROM roles WHERE id = ?1').bind(id).first<{ id: number }>();
    if (!roleExists) {
      return c.json(RoleNotFoundErrorSchema.parse({ message: 'Role not found.' }), 404);
    }

    // 2. Check if the role is assigned to any users
    const assignmentCheck = await c.env.DB.prepare('SELECT user_id FROM user_roles WHERE role_id = ?1 LIMIT 1')
      .bind(id)
      .first<{ user_id: number }>();

    if (assignmentCheck) {
      return c.json(RoleDeleteFailedErrorSchema.parse({ message: 'Cannot delete role: It is assigned to active users.' }), 400);
    }

    // 3. Delete role from the database
    const stmt = c.env.DB.prepare('DELETE FROM roles WHERE id = ?1').bind(id);
    const result = await stmt.run();

    if (result.success && result.meta.changes > 0) {
      return c.json(RoleDeleteResponseSchema.parse({ message: 'Role deleted successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
      // This case should ideally be caught by the existence check above, but as a safeguard:
      return c.json(RoleNotFoundErrorSchema.parse({ message: 'Role not found or already deleted.' }), 404);
    } else {
      console.error('Failed to delete role, D1 result:', result);
      return c.json(RoleDeleteFailedErrorSchema.parse({ message: 'Failed to delete role.' }), 500);
    }

  } catch (error) {
    console.error('Error deleting role:', error);
    return c.json(RoleDeleteFailedErrorSchema.parse({ message: 'Failed to delete role due to a server error.' }), 500);
  }
};
