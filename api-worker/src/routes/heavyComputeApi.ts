import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { getTokenHandler } from '../handlers/heavyComputeApi/getToken.handler';
import { GetTokenResponseSchema } from '../schemas/heavyComputeApiSchemas';
import { GeneralServerErrorSchema, GeneralUnauthorizedErrorSchema } from '../schemas/commonSchemas';

// Assuming CloudflareBindings is a globally available type for your environment bindings
const heavyComputeApi = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const getTokenRoute = createRoute({
  method: 'get',
  path: '/get-token',
  summary: 'Get Heavy Compute API Token',
  description: 'Retrieves a bearer token for the Heavy Compute API. This token is read from the server-side environment variables and provided to authenticated clients. Ensure this endpoint is adequately protected as the token grants access to the Heavy Compute API.',
  security: [
    {
      // Assuming you have a security scheme named 'BearerAuth' or similar defined in your main app.doc
      // If not, this might need adjustment or definition in your global OpenAPI setup.
      // For now, this indicates that bearer token authentication is required.
      BearerAuth: [],
    },
  ],
  tags: ['Heavy Compute API'],
  responses: {
    200: {
      description: 'Successfully retrieved the API token.',
      content: {
        'application/json': {
          schema: GetTokenResponseSchema,
        },
      },
    },
    401: {
        description: 'Unauthorized. Authentication is required or has failed.',
        content: {
            'application/json': {
                schema: GeneralUnauthorizedErrorSchema,
            }
        }
    },
    500: {
      description: 'Internal Server Error. Could not retrieve or process the token.',
      content: {
        'application/json': {
          schema: GeneralServerErrorSchema,
        },
      },
    },
  },
});

heavyComputeApi.openapi(getTokenRoute, getTokenHandler);

export default heavyComputeApi;
