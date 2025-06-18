// src/routes/users.ts
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { CloudflareEnv } from '../env';
import {
  UserSchema,
  UserCreateRequestSchema,
  UserCreateResponseSchema,
  ListUsersResponseSchema,
  GetUserResponseSchema,
  UserUpdateRequestSchema,
  UserUpdateResponseSchema,
  UserDeleteResponseSchema,
  UserNotFoundErrorSchema,
  UserCreateFailedErrorSchema,
  UserUpdateFailedErrorSchema,
  UserEmailExistsErrorSchema
} from '../schemas/userSchemas';
import {
  PathIdParamSchema,
  GeneralServerErrorSchema,
  GeneralBadRequestErrorSchema
} from '../schemas/commonSchemas';
import { createUserHandler } from '../handlers/users/createUser.handler';
import { listUsersHandler } from '../handlers/users/listUsers.handler';
import { getUserByIdHandler } from '../handlers/users/getUserById.handler';
import { updateUserHandler } from '../handlers/users/updateUser.handler';
import { deleteUserHandler } from '../handlers/users/deleteUser.handler';

const userRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>();

// POST /users - Create User
const createUserRouteDef = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: UserCreateRequestSchema } },
      description: 'Data for the new user.',
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: UserCreateResponseSchema } },
      description: 'User created successfully.',
    },
    400: {
      content: { 'application/json': { schema: z.union([UserCreateFailedErrorSchema, UserEmailExistsErrorSchema]) } },
      description: 'Invalid input or user already exists.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Creates a new user.',
  tags: ['Users'],
});

userRoutes.openapi(createUserRouteDef, createUserHandler);

// GET /users - List Users
const listUsersRouteDef = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ example: '1', description: 'Page number for pagination.' }),
      limit: z.string().optional().openapi({ example: '10', description: 'Number of items per page.' }),
    }).openapi('ListUsersQuery'),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListUsersResponseSchema } },
      description: 'A list of users.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request (e.g., invalid query parameters).',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Lists all users.',
  tags: ['Users'],
});

userRoutes.openapi(listUsersRouteDef, listUsersHandler);

// GET /users/{id} - Get User by ID
const getUserByIdRouteDef = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GetUserResponseSchema } },
      description: 'Details of the user.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request (e.g., invalid ID format).',
    },
    404: {
      content: { 'application/json': { schema: UserNotFoundErrorSchema } },
      description: 'User not found.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Gets a specific user by their ID.',
  tags: ['Users'],
});

userRoutes.openapi(getUserByIdRouteDef, getUserByIdHandler);

// PUT /users/{id} - Update User
const updateUserRouteDef = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
    body: {
      content: { 'application/json': { schema: UserUpdateRequestSchema } },
      description: 'Data to update for the user.',
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserUpdateResponseSchema } },
      description: 'User updated successfully.',
    },
    400: {
      content: { 'application/json': { schema: z.union([UserUpdateFailedErrorSchema, UserEmailExistsErrorSchema]) } },
      description: 'Invalid input or email already exists.',
    },
    404: {
      content: { 'application/json': { schema: UserNotFoundErrorSchema } },
      description: 'User not found.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Updates an existing user.',
  tags: ['Users'],
});

userRoutes.openapi(updateUserRouteDef, updateUserHandler);

// DELETE /users/{id} - Delete User
const deleteUserRouteDef = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: PathIdParamSchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserDeleteResponseSchema } },
      description: 'User deleted successfully.',
    },
    400: {
      content: { 'application/json': { schema: GeneralBadRequestErrorSchema } },
      description: 'Bad request (e.g., invalid ID format or deletion constraints).',
    },
    404: {
      content: { 'application/json': { schema: UserNotFoundErrorSchema } },
      description: 'User not found.',
    },
    500: {
      content: { 'application/json': { schema: GeneralServerErrorSchema } },
      description: 'An unexpected error occurred.',
    },
  },
  summary: 'Deletes a user.',
  tags: ['Users'],
});

userRoutes.openapi(deleteUserRouteDef, deleteUserHandler);

export default userRoutes;
