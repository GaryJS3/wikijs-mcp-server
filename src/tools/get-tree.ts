/** wikijs_get_tree: browse the Wiki.js page hierarchy. */
import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { pageTreeSchema } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const getTreeToolDefinition = {
  name: 'wikijs_get_tree',
  description: 'Browse the Wiki.js page hierarchy by locale, path, or parent page. Read-only.',
  inputSchema: pageTreeSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export async function handleGetTree(client: WikiJsClient, args: z.infer<typeof pageTreeSchema>) {
  try {
    const input = pageTreeSchema.parse(args);
    const tree = await client.getPageTree(input.path ?? null, input.parent ?? null, input.mode, input.locale, input.includeAncestors);
    return successResponse({ tree, count: tree.length, locale: input.locale, mode: input.mode });
  } catch (error) {
    return handleToolError(error, 'wikijs_get_tree');
  }
}
