// src/schemas/roleSchemas.ts
import { z } from '@hono/zod-openapi';
import {
  MessageResponseSchema,
  GeneralBadRequestErrorSchema,
  GeneralNotFoundErrorSchema,
  GeneralServerErrorSchema // For generic 500 errors if needed
} from './commonSchemas';

// Schema for a single permission
export const RolePermissionSchema = z.string().min(1).max(100)
  .openapi({ example: 'manage_users', description: 'A specific permission string.' });

// Base schema for role properties
const RoleBaseSchema = z.object({
  name: z.string().min(1).max(100)
    .openapi({ example: 'Administrator', description: 'The name of the role.' }),
  description: z.string().max(500) // Made non-optional
    .openapi({ example: 'Full access to all system features.', description: 'A description of the role.' }),
  permissions: z.array(RolePermissionSchema) // Removed .min(1) constraint
    .openapi({ example: ['manage_users', 'manage_posts'], description: 'List of permissions associated with the role.' }),
}).openapi('RoleBase');

// Full Role schema for API responses
export const RoleSchema = RoleBaseSchema.extend({
  id: z.number().int().positive().openapi({ example: 1, description: 'Unique identifier for the role.' }),
  created_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the role was created.' }),
  updated_at: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z', description: 'Timestamp of when the role was last updated.' }),
}).openapi('Role');

// Schema for creating a new role
export const RoleCreateRequestSchema = RoleBaseSchema;

export const RoleCreateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Role created successfully.'),
  roleId: z.number().int().positive().openapi({ example: 101 }),
}).openapi('RoleCreateResponse');

// Schema for listing roles
export const ListRolesResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  roles: z.array(RoleSchema)
}).openapi('ListRolesResponse');

// Schema for getting a single role
export const GetRoleResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  role: RoleSchema
}).openapi('GetRoleResponse');

// Schema for updating a role
export const RoleUpdateRequestSchema = RoleBaseSchema.partial().openapi('RoleUpdateRequest');

export const RoleUpdateResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Role updated successfully.')
}).openapi('RoleUpdateResponse');

// Schema for deleting a role
export const RoleDeleteResponseSchema = MessageResponseSchema.extend({
  message: z.literal('Role deleted successfully.')
}).openapi('RoleDeleteResponse');

// --- Specific Error Schemas for Roles ---
export const RoleNameExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Role name already exists.' })
}).openapi('RoleNameExistsError');

export const RoleCreateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to create role.' })
}).openapi('RoleCreateFailedError');

export const RoleUpdateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to update role.' })
}).openapi('RoleUpdateFailedError');

export const RoleDeleteFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Cannot delete role: It is assigned to active users.' })
}).openapi('RoleDeleteFailedError');

export const RoleNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
  message: z.string().openapi({ example: 'Role not found.' })
}).openapi('RoleNotFoundError');
