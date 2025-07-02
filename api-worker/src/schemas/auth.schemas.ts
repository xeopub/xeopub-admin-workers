// src/schemas/authSchemas.ts
import { z } from '@hono/zod-openapi';
import { ErrorSchema, MessageResponseSchema } from './common.schemas';

// POST /auth/login
export const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().min(1).openapi({ example: 'yourpassword' }),
}).openapi('LoginRequest');

export const LoginSuccessResponseSchema = z.object({
}).openapi('LoginSuccessResponse');

export const LoginMissingFieldsErrorSchema = ErrorSchema.extend({
  error: z.literal('missing'),
  message: z.literal('Email and password are required.'),
}).openapi('LoginMissingFieldsError');

export const LoginUserNotFoundErrorSchema = ErrorSchema.extend({
  error: z.literal('invalid'),
  message: z.literal('Invalid user or password.'),
}).openapi('LoginUserNotFoundError');

export const LoginInvalidPasswordErrorSchema = ErrorSchema.extend({
  error: z.literal('invalid'),
  message: z.literal('Invalid user or password.'),
}).openapi('LoginInvalidPasswordError');

export const LoginRoleConfigErrorSchema = ErrorSchema.extend({
  error: z.literal('authentication_failed'),
  message: z.literal('User role configuration error.'),
}).openapi('LoginRoleConfigError');

export const LoginInternalErrorSchema = ErrorSchema.extend({
  error: z.literal('authentication_failed'),
  message: z.literal('An internal error occurred during login.'),
}).openapi('LoginInternalError');


// GET /auth/session
export const SessionUserSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  email: z.string().email().openapi({ example: 'user@example.com' }),
  name: z.string().nullable().openapi({ example: 'John Doe' }),
  role: z.string().openapi({ example: 'editor' }),
}).openapi('SessionUser');

export const SessionActiveResponseSchema = z.object({
  isActive: z.literal(true),
  user: SessionUserSchema,
}).openapi('SessionActiveResponse', {
  example: {
    isActive: true,
    user: {
      id: 1,
      email: 'user@example.com',
      name: 'John Doe',
      role: 'admin',
    },
  },
});

export const SessionInactiveResponseSchema = z.object({
  isActive: z.literal(false),
}).openapi('SessionInactiveResponse', {
  example: {
    isActive: false,
  },
});

export const SessionErrorResponseSchema = ErrorSchema.extend({
  error: z.literal('session_error'),
  message: z.literal('An error occurred while fetching session status.'),
}).openapi('SessionErrorResponse', {
  example: {
    error: 'session_error',
    message: 'An error occurred while fetching session status.',
  },
});

// POST /auth/logout
export const LogoutSuccessResponseSchema = MessageResponseSchema.extend({
    message: z.literal('Logged out successfully.')
}).openapi('LogoutSuccessResponse');

export const LogoutFailedErrorSchema = ErrorSchema.extend({
  error: z.literal('logout_failed'),
  message: z.literal('An internal error occurred during logout.'),
}).openapi('LogoutFailedError');
