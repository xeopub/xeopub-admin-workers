import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  RoleSchema,
  GetRoleResponseSchema,
  RoleNotFoundErrorSchema
} from '../../schemas/role.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

interface RoleFromDB {
  id: number;
  name: string;
  description: string; // Changed from string | null
  permissions: string; // JSON string
  created_at: string;
  updated_at: string;
}

export const getRoleByIdHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    const dbRole = await c.env.DB.prepare(
      'SELECT id, name, description, permissions, created_at, updated_at FROM roles WHERE id = ?1'
    ).bind(id).first<RoleFromDB>();

    if (!dbRole) {
      return c.json(RoleNotFoundErrorSchema.parse({ message: 'Role not found.' }), 404);
    }

    let parsedPermissions: string[];
    try {
      parsedPermissions = JSON.parse(dbRole.permissions);
      if (!Array.isArray(parsedPermissions) || !parsedPermissions.every(p => typeof p === 'string')) {
        console.error(`Invalid permissions format in DB for role ID ${dbRole.id}:`, dbRole.permissions);
        return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing role data.' }), 500);
      }
    } catch (e) {
      console.error(`Failed to parse permissions from DB for role ID ${dbRole.id}:`, e);
      return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing role data.' }), 500);
    }

    const roleForValidation = {
      id: dbRole.id,
      name: dbRole.name,
      description: dbRole.description,
      permissions: parsedPermissions,
      createdAt: dbRole.created_at,
      updatedAt: dbRole.updated_at,
    };

    const validation = RoleSchema.safeParse(roleForValidation);
    if (!validation.success) {
      console.error(`Data for role ID ${dbRole.id} failed RoleSchema validation after DB fetch:`, validation.error.flatten());
      return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing role data.' }), 500);
    }

    return c.json(GetRoleResponseSchema.parse({ role: validation.data }), 200);

  } catch (error) {
    console.error('Error getting role by ID:', error);
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to retrieve role due to a server error.' }), 500);
  }
};
