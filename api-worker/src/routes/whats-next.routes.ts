import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { listWhatsNextPosts } from '../handlers/whats-next/list-posts.handler';
import { WhatsNextResponseSchema } from '../schemas/whats-next.schemas';
import { GeneralServerErrorSchema } from '../schemas/common.schemas';
import type { CloudflareEnv } from '../env';

const whatsNextRoutes = new OpenAPIHono<{ Bindings: CloudflareEnv }>();

const getWhatsNextRoute = createRoute({
    method: 'get',
    path: '/',
    summary: 'Get a summary of what to work on next',
    description: 'Provides a categorized list of posts and tasks that require attention, such as generating materials, publishing, and researching.',
    responses: {
        200: {
            description: 'Successful response with the what\'s next data.',
            content: {
                'application/json': {
                    schema: WhatsNextResponseSchema,
                },
            },
        },
        500: {
            description: 'Internal Server Error',
            content: {
                'application/json': {
                    schema: GeneralServerErrorSchema,
                },
            },
        },
    },
    tags: ['What\'s Next'],
});

whatsNextRoutes.openapi(getWhatsNextRoute, listWhatsNextPosts);

export default whatsNextRoutes;
