import { Context } from 'hono';
import { z } from 'zod';
import { GetTokenResponseSchema, GetTokenResponse } from '../../schemas/heavyComputeApiSchemas';
// Assuming CloudflareBindings (or a similar type for environment variables) is available in your project context.
// For this handler, we specifically need HEAVY_COMPUTE_API_KEY from the environment.
// Example: Context<{ Bindings: { HEAVY_COMPUTE_API_KEY: string; /* other bindings */ } }>

export const getTokenHandler = async (c: Context<{ Bindings: CloudflareBindings & { ENVIRONMENT?: string; HEAVY_COMPUTE_API_KEY?: string; } }>) => {
  // Check for development environment first
  // Assumes c.env.ENVIRONMENT can be 'development', 'staging', 'production', etc.
  if (c.env.ENVIRONMENT === 'development') {
    const devToken = "your_secret_bearer_token_here";
    const responsePayload: GetTokenResponse = { token: devToken };
    try {
      // Validate that the dev token structure matches the schema
      GetTokenResponseSchema.parse(responsePayload);
      return c.json(responsePayload, 200);
    } catch (error) {
      console.error('Error preparing or validating dev token response:', error);
      let message = 'Internal server error while processing dev token.';
      if (error instanceof z.ZodError) {
        message = `Invalid dev token data: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`;
      }
      // Adhere to GeneralServerErrorSchema structure for 500 responses
      return c.json({
        success: false,
        message: message,
      }, 500);
    }
  }

  // Original logic for non-development environments
  const apiKey = c.env.HEAVY_COMPUTE_API_KEY;

  if (!apiKey) {
    console.error('HEAVY_COMPUTE_API_KEY is not set in environment variables for non-dev environment.');
    // Adhere to GeneralServerErrorSchema structure for 500 responses
    return c.json({
      success: false,
      message: 'Internal server error: API key not configured for this environment.',
    }, 500);
  }

  try {
    const responsePayload: GetTokenResponse = { token: apiKey };
    // This parse call also validates that apiKey is a non-empty string as per GetTokenResponseSchema
    GetTokenResponseSchema.parse(responsePayload);

    // Conforms to GetTokenResponseSchema for 200 responses
    return c.json(responsePayload, 200);
  } catch (error) {
    console.error('Error preparing or validating token response:', error);
    let message = 'Internal server error while processing token.';
    if (error instanceof z.ZodError) {
      // Construct a more detailed message from Zod issues
      message = `Invalid token data: ${error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`;
    }

    // Adhere to GeneralServerErrorSchema structure for 500 responses
    return c.json({
      success: false,
      message: message,
    }, 500);
  }
};
