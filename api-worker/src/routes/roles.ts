// src/routes/roles.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  RoleCreateRequestSchema,
  RoleCreateResponseSchema,
  ListRolesResponseSchema,
  GetRoleResponseSchema,
  RoleUpdateRequestSchema,
  RoleUpdateResponseSchema,
  RoleDeleteResponseSchema,
  RoleSchema,
  RoleNameExistsErrorSchema,
  RoleCreateFailedErrorSchema,
  RoleNotFoundErrorSchema,
  RoleUpdateFailedErrorSchema,
  RoleDeleteFailedErrorSchema
} from '../schemas/roleSchemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../schemas/commonSchemas';
import { createRoleHandler } from '../handlers/roles/createRole.handler';
import { listRolesHandler } from '../handlers/roles/listRoles.handler';
import { getRoleByIdHandler } from '../handlers/roles/getRoleById.handler';
import { updateRoleHandler } from '../handlers/roles/updateRole.handler';
import { deleteRoleHandler } from '../handlers/roles/deleteRole.handler';

const roleRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>();

// POST /roles - Create Role
const createRoleRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: { content: { 'application/json': { schema: RoleCreateRequestSchema } } },
  },
  responses: {
    201: { content: { 'application/json': { schema: RoleCreateResponseSchema } }, description: 'Role created' },
    400: { content: { 'application/json': { schema: z.union([RoleNameExistsErrorSchema, RoleCreateFailedErrorSchema]) } }, description: 'Invalid input or role name exists' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Creates a new role.',
  tags: ['Roles'],
});
roleRoutes.openapi(createRoleRouteDef, createRoleHandler);

// GET /roles - List Roles
const listRolesRouteDef = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: { content: { 'application/json': { schema: ListRolesResponseSchema } }, description: 'List of roles' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Bad request' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Lists all roles.',
  tags: ['Roles'],
});
roleRoutes.openapi(listRolesRouteDef, listRolesHandler);

// GET /roles/{id} - Get Role by ID
const getRoleByIdRouteDef = createRoute({
  method: 'get',
  path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: GetRoleResponseSchema } }, description: 'Role details' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Bad request' },
    404: { content: { 'application/json': { schema: RoleNotFoundErrorSchema } }, description: 'Role not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Gets a role by ID.',
  tags: ['Roles'],
});
roleRoutes.openapi(getRoleByIdRouteDef, getRoleByIdHandler);

// PUT /roles/{id} - Update Role
const updateRoleRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
    body: { content: { 'application/json': { schema: RoleUpdateRequestSchema } } },
  },
  responses: {
    200: { content: { 'application/json': { schema: RoleUpdateResponseSchema } }, description: 'Role updated' },
    400: { content: { 'application/json': { schema: z.union([RoleNameExistsErrorSchema, RoleUpdateFailedErrorSchema]) } }, description: 'Invalid input or role name exists' },
    404: { content: { 'application/json': { schema: RoleNotFoundErrorSchema } }, description: 'Role not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Updates an existing role.',
  tags: ['Roles'],
});
roleRoutes.openapi(updateRoleRouteDef, updateRoleHandler);

// DELETE /roles/{id} - Delete Role
const deleteRoleRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  request: { params: PathIdParamSchema },
  responses: {
    200: { content: { 'application/json': { schema: RoleDeleteResponseSchema } }, description: 'Role deleted' },
    400: { content: { 'application/json': { schema: RoleDeleteFailedErrorSchema } }, description: 'Deletion failed (e.g., role in use)' },
    404: { content: { 'application/json': { schema: RoleNotFoundErrorSchema } }, description: 'Role not found' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Deletes a role.',
  tags: ['Roles'],
});
roleRoutes.openapi(deleteRoleRouteDef, deleteRoleHandler);

export default roleRoutes;
