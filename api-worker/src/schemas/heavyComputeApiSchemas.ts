import { z } from 'zod';

export const GetTokenResponseSchema = z.object({
  token: z.string().min(1, { message: 'Token cannot be empty' }),
});

export type GetTokenResponse = z.infer<typeof GetTokenResponseSchema>;
