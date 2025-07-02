// src/routes/roles.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  RoleCreateRequestSchema,
  RoleCreateResponseSchema,
  ListRolesResponseSchema,
  ListRolesQuerySchema, // Added import for query schema
  GetRoleResponseSchema,
  RoleUpdateRequestSchema,
  RoleUpdateResponseSchema,
  RoleDeleteResponseSchema,
  RoleNameExistsErrorSchema,
  RoleCreateFailedErrorSchema,
  RoleNotFoundErrorSchema,
  RoleUpdateFailedErrorSchema,
  RoleDeleteFailedErrorSchema
} from '../schemas/role.schemas';
import { PathIdParamSchema, GeneralServerErrorSchema, GeneralBadRequestErrorSchema } from '../schemas/common.schemas';
import { createRoleHandler } from '../handlers/roles/create-role.handler';
import { listRolesHandler } from '../handlers/roles/list-roles.handler';
import { getRoleByIdHandler } from '../handlers/roles/get-role-by-id.handler';
import { updateRoleHandler } from '../handlers/roles/update-role.handler';
import { deleteRoleHandler } from '../handlers/roles/delete-role.handler';

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
  request: {
    query: ListRolesQuerySchema, // Added query parameters schema
  },
  responses: {
    200: { content: { 'application/json': { schema: ListRolesResponseSchema } }, description: 'List of roles with pagination' },
    400: { content: { 'application/json': { schema: GeneralBadRequestErrorSchema } }, description: 'Bad request (e.g., invalid query parameters)' },
    500: { content: { 'application/json': { schema: GeneralServerErrorSchema } }, description: 'Server error' },
  },
  summary: 'Lists all roles with pagination and filtering.',
  description: 'Retrieves a list of roles, allowing pagination and filtering by name.',
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
