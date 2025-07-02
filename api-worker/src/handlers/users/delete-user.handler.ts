import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  UserDeleteResponseSchema,
  UserNotFoundErrorSchema
  // UserDeleteFailedErrorSchema was removed as it doesn't exist
} from '../../schemas/user.schemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/common.schemas';

export const deleteUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({
      message: 'Invalid ID format in path.',
      errors: paramValidation.error.flatten().fieldErrors,
    }), 400);
  }
  const { id } = paramValidation.data;

  try {
    const result = await c.env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(id).run();

    if (result.meta.changes > 0) {
      return c.json(UserDeleteResponseSchema.parse({ message: 'User deleted successfully.' }), 200);
    }
    // No rows affected means user with that ID was not found
    return c.json(UserNotFoundErrorSchema.parse({ message: 'User not found.' }), 404);

  } catch (error: any) {
    console.error(`Error deleting user ${id}:`, error);
    return c.json(GeneralServerErrorSchema.parse({ message: 'Failed to delete user due to a server error.' }), 500);
  }
};
