// src/schemas/userSchemas.ts
import { z } from '@hono/zod-openapi';
import {
  MessageResponseSchema,
  GeneralBadRequestErrorSchema,
  GeneralNotFoundErrorSchema,
  PaginationInfoSchema // Corrected import for pagination
} from './common.schemas';

// Base schema for role properties
export const RoleSchema = z.object({
  id: z.number().int().positive().openapi({ example: 1 }),
  name: z.string().openapi({ example: 'editor' }),
}).openapi('Role');

// Base schema for user properties, used for creation and updates
const UserBaseSchema = z.object({
  email: z.string().email().max(255).openapi({ example: 'user@example.com' }),
  name: z.string().min(1).max(255).openapi({ example: 'John Doe' }),
}).openapi('UserBase');

// Full User schema, potentially including sensitive data from the database
export const UserSchema = UserBaseSchema.extend({
  id: z.number().int().positive().openapi({ example: 1 }),
  password_hash: z.string(), // Represents the hash from the DB
  createdAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
  updatedAt: z.coerce.date().openapi({ example: '2023-01-01T12:00:00Z' }),
  roles: z.array(RoleSchema).optional().openapi({ description: 'Roles assigned to the user' }),
}).openapi('User');

// Schema for user data returned in API responses, omitting sensitive fields.
export const UserOutputSchema = UserSchema.omit({ password_hash: true }).openapi('UserOutput');

// Enum for sortable fields for Users
export const UserSortBySchema = z.enum([
  'id',
  'name',
  'email',
  'createdAt',
  'updatedAt'
]).openapi({ description: 'Field to sort users by.', example: 'name' });

// Enum for sort order
export const SortOrderSchema = z.enum(['asc', 'desc']).openapi({ description: 'Sort order.', example: 'asc' });

// Schema for creating a new user
export const UserCreateRequestSchema = UserBaseSchema.extend({
  roleIds: z.array(z.number().int().positive()).optional().openapi({ example: [1, 2], description: 'Array of role IDs to assign to the user. Defaults to [2] (editor) if not provided.' }),
  password: z.string().min(8).max(255).openapi({ example: 'SecurePassword123' }),
}).openapi('UserCreateRequest');

export const UserCreateResponseSchema = MessageResponseSchema.extend({
  message: z.string().openapi({ example: 'User created successfully.' }),
  id: z.number().int().positive().openapi({ example: 101 }),
}).openapi('UserCreateResponse');

// Schema for query parameters when listing users
export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1).openapi({
    description: 'Page number for pagination.',
    example: 1,
  }),
  limit: z.coerce.number().int().positive().max(100).optional().default(10).openapi({
    description: 'Number of items per page.',
    example: 10,
  }),
  name: z.string().optional().openapi({
    description: 'Filter by user name (case-insensitive, partial match).',
    example: 'John',
  }),
  email: z.string().email().optional().openapi({
    description: 'Filter by user email (case-insensitive, partial match).',
    example: 'user@example.com',
  }),
  sortBy: UserSortBySchema.optional().default('name')
    .openapi({ description: 'Field to sort users by.', example: 'name' }),
  sortOrder: SortOrderSchema.optional().default('asc')
    .openapi({ description: 'Sort order (asc/desc).', example: 'asc' })
}).openapi('ListUsersQuery');

// Schema for listing users
export const ListUsersResponseSchema = z.object({
  users: z.array(UserOutputSchema),
  pagination: PaginationInfoSchema, // Corrected to use PaginationInfoSchema
}).openapi('ListUsersResponse');

// Schema for getting a single user
export const GetUserResponseSchema = z.object({
  user: UserOutputSchema,
}).openapi('GetUserResponse');

// Schema for updating an existing user (all fields optional)
// Schema for updating an existing user (all fields optional)
export const UserUpdateRequestSchema = UserBaseSchema.extend({
  roleIds: z.array(z.number().int().positive()).optional().openapi({ example: [1], description: 'Array of role IDs to assign. This will replace all existing roles.' }),
  password: z.string().min(8).max(255).optional().openapi({ example: 'NewSecurePassword123', description: 'Only provide if changing the password.' }),
}).partial({
  email: true,
  name: true,
}).openapi('UserUpdateRequest');

export const UserUpdateResponseSchema = MessageResponseSchema.extend({
  message: z.string().openapi({ example: 'User updated successfully.' }),
}).openapi('UserUpdateResponse');

// Schema for deleting a user
export const UserDeleteResponseSchema = MessageResponseSchema.extend({
  message: z.string().openapi({ example: 'User deleted successfully.' }),
}).openapi('UserDeleteResponse');

// Error Schemas specific to Users
export const UserNotFoundErrorSchema = GeneralNotFoundErrorSchema.extend({
  message: z.string().openapi({ example: 'User not found.' }),
}).openapi('UserNotFoundError');

export const UserCreateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to create user.' }),
  // errors: z.record(z.string()).optional().openapi({ example: { email: 'Invalid email format' } })
}).openapi('UserCreateFailedError');

export const UserUpdateFailedErrorSchema = GeneralBadRequestErrorSchema.extend({
  message: z.string().openapi({ example: 'Failed to update user.' }),
}).openapi('UserUpdateFailedError');

export const UserEmailExistsErrorSchema = GeneralBadRequestErrorSchema.extend({
    message: z.string().openapi({ example: 'A user with this email already exists.' }),
    error: z.literal('emailExists').optional()
}).openapi('UserEmailExistsError');
