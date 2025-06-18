import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import { RoleSchema, ListRolesResponseSchema } from '../../schemas/roleSchemas';
import { GeneralServerErrorSchema } from '../../schemas/commonSchemas';

interface RoleFromDB {
  id: number;
  name: string;
  description: string; // Changed from string | null
  permissions: string; // JSON string
  created_at: string;
  updated_at: string;
}

export const listRolesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT id, name, description, permissions, created_at, updated_at FROM roles ORDER BY id ASC').all<RoleFromDB>();

    if (!results) {
      // This case might occur if the query itself fails in a way D1 doesn't throw, or if results is undefined/null
      return c.json(ListRolesResponseSchema.parse({ success: true, roles: [] }), 200);
    }

    const roles = results.map(dbRole => {
      let parsedPermissions: string[];
      try {
        parsedPermissions = JSON.parse(dbRole.permissions);
        if (!Array.isArray(parsedPermissions) || !parsedPermissions.every(p => typeof p === 'string')) {
          console.warn(`Invalid permissions format for role ID ${dbRole.id}:`, dbRole.permissions);
          parsedPermissions = []; // Default to empty array or handle as error
        }
      } catch (e) {
        console.warn(`Failed to parse permissions for role ID ${dbRole.id}:`, e);
        parsedPermissions = []; // Default to empty array or handle as error
      }
      
      // Validate each role against the RoleSchema after parsing permissions
      // This ensures the structure is correct before sending it in the response.
      const roleForValidation = {
        ...dbRole,
        description: dbRole.description, // Directly use dbRole.description as it's now string
        permissions: parsedPermissions,
      };

      const validation = RoleSchema.safeParse(roleForValidation);
      if (!validation.success) {
        console.error(`Data for role ID ${dbRole.id} failed RoleSchema validation after DB fetch:`, validation.error.flatten());
        // Decide how to handle: skip this role, return error, etc.
        // For now, we'll filter out invalid roles. A more robust solution might log and alert.
        return null;
      }
      return validation.data;
    }).filter(role => role !== null); // Filter out any roles that failed validation

    return c.json(ListRolesResponseSchema.parse({ success: true, roles }), 200);

  } catch (error) {
    console.error('Error listing roles:', error);
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to list roles due to a server error.' }), 500);
  }
};
