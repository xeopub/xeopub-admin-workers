import { Context } from 'hono';
import { z } from '@hono/zod-openapi'; // Added for ZodError
import type { CloudflareEnv } from '../../env';
import {
  RoleSchema,
  ListRolesResponseSchema,
  ListRolesQuerySchema,
  RoleSortBySchema, // Added for sorting
} from '../../schemas/role.schemas';
import { GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../../schemas/common.schemas';

interface RoleFromDB {
  id: number;
  name: string;
  description: string;
  permissions: string; // JSON string
  created_at: string;
  updated_at: string;
}

export const listRolesHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const queryParseResult = ListRolesQuerySchema.safeParse(c.req.query());

  if (!queryParseResult.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
      message: 'Invalid query parameters.',
      errors: queryParseResult.error.flatten().fieldErrors
    }), 400);
  }

  const { page, limit, name, sortBy, sortOrder } = queryParseResult.data;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let bindings: (string | number)[] = [];
  let paramIndex = 1;

  if (name) {
    whereClauses.push(`LOWER(name) LIKE LOWER(?${paramIndex++})`);
    bindings.push(`%${name}%`);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Whitelist of sortable columns and their actual DB names
  const validSortColumns: Record<z.infer<typeof RoleSortBySchema>, string> = {
    id: 'id',
    name: 'name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };

  const orderByColumn = validSortColumns[sortBy] || 'name'; // Default to 'name'
  const orderByDirection = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'; // Default to ASC

  const orderByString = `ORDER BY ${orderByColumn} ${orderByDirection}`;

  try {
    const rolesQuery = c.env.DB.prepare(
      `SELECT id, name, description, permissions, created_at, updated_at FROM roles ${whereString} ${orderByString} LIMIT ?${paramIndex++} OFFSET ?${paramIndex++}`
    ).bind(...bindings, limit, offset);

    const countQuery = c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM roles ${whereString}`
    ).bind(...bindings);

    const [rolesDbResult, countResult] = await Promise.all([
      rolesQuery.all<RoleFromDB>(),
      countQuery.first<{ total: number }>()
    ]);

    if (!rolesDbResult.results || countResult === null) {
      console.error('Failed to fetch roles or count, D1 results:', rolesDbResult, countResult);
      return c.json(GeneralServerErrorSchema.parse({
        message: 'Failed to retrieve roles from the database.'
      }), 500);
    }

    const processedRoles = rolesDbResult.results.map((dbRole: RoleFromDB) => {
      let parsedPermissions: string[];
      try {
        parsedPermissions = JSON.parse(dbRole.permissions);
        if (!Array.isArray(parsedPermissions) || !parsedPermissions.every(p => typeof p === 'string')) {
          console.warn(`Invalid permissions format for role ID ${dbRole.id}:`, dbRole.permissions);
          parsedPermissions = [];
        }
      } catch (e) {
        console.warn(`Failed to parse permissions for role ID ${dbRole.id}:`, e);
        parsedPermissions = [];
      }
      
      const roleValidation = RoleSchema.safeParse({
        id: dbRole.id,
        name: dbRole.name,
        description: dbRole.description,
        permissions: parsedPermissions,
        createdAt: dbRole.created_at,
        updatedAt: dbRole.updated_at,
      });

      if (roleValidation.success) {
        return roleValidation.data;
      }
      console.error(`Error parsing role ID ${dbRole.id} in list:`, roleValidation.error.flatten());
      return null; 
    }).filter(Boolean) as z.infer<typeof RoleSchema>[];

    const totalItems = countResult.total;
    const totalPages = Math.ceil(totalItems / limit);

    const pagination = {
      page,
      limit,
      totalItems,
      totalPages,
    };

    return c.json(ListRolesResponseSchema.parse({
      roles: processedRoles,
      pagination: pagination,
    }), 200);

  } catch (error) {
    console.error('Error listing roles:', error);
    if (error instanceof z.ZodError) {
        return c.json(GeneralServerErrorSchema.parse({ message: 'Error processing role data.', errors: error.flatten() }), 500);
    }
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to list roles due to an unexpected error.' }), 500);
  }
};
