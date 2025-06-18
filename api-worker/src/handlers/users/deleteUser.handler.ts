import { Context } from 'hono';
import type { CloudflareEnv } from '../../env';
import {
  UserDeleteResponseSchema,
  UserNotFoundErrorSchema
  // UserDeleteFailedErrorSchema was removed as it doesn't exist
} from '../../schemas/userSchemas';
import { PathIdParamSchema, GeneralBadRequestErrorSchema, GeneralServerErrorSchema } from '../../schemas/commonSchemas';

export const deleteUserHandler = async (c: Context<{ Bindings: CloudflareEnv }>) => {
  const paramValidation = PathIdParamSchema.safeParse(c.req.param());

  if (!paramValidation.success) {
    return c.json(GeneralBadRequestErrorSchema.parse({ success: false, message: 'Invalid ID format.' }), 400);
  }
  const id = parseInt(paramValidation.data.id, 10);

  try {
    // Attempt to delete the user
    // D1's run() result for DELETE includes meta.changes which is the number of rows affected.
    const stmt = c.env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(id);
    const result = await stmt.run();

    if (result.success && result.meta.changes > 0) {
      return c.json(UserDeleteResponseSchema.parse({ success: true, message: 'User deleted successfully.' }), 200);
    } else if (result.success && result.meta.changes === 0) {
      // No rows affected means user with that ID was not found
      return c.json(UserNotFoundErrorSchema.parse({ success: false, message: 'User not found.' }), 404);
    } else {
      // This could be a D1 error, e.g. if a foreign key constraint prevents deletion
      console.error('Failed to delete user, D1 result:', result);
      return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to delete user due to a database error.' }), 500);
    }

  } catch (error) {
    console.error('Error deleting user:', error);
    // Check for specific D1 constraint errors if necessary, e.g.:
    // if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
    //   return c.json(UserDeleteFailedErrorSchema.parse({ success: false, message: 'Cannot delete user. User is referenced elsewhere.' }), 409); // Conflict
    // }
    return c.json(GeneralServerErrorSchema.parse({ success: false, message: 'Failed to delete user due to a server error.' }), 500);
  }
};
