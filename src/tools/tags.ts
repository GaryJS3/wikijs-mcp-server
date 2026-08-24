/** Wiki.js tag discovery tools. */
import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { listTagsSchema, searchTagsSchema } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const listTagsToolDefinition = {
  name: 'wikijs_list_tags',
  description: 'List tags defined in Wiki.js. Read-only.',
  inputSchema: listTagsSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export async function handleListTags(client: WikiJsClient, args: z.infer<typeof listTagsSchema>) {
  try {
    listTagsSchema.parse(args);
    const tags = await client.listTags();
    return successResponse({ tags, count: tags.length });
  } catch (error) {
    return handleToolError(error, 'wikijs_list_tags');
  }
}

export const searchTagsToolDefinition = {
  name: 'wikijs_search_tags',
  description: 'Search Wiki.js tags by text. Read-only.',
  inputSchema: searchTagsSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export async function handleSearchTags(client: WikiJsClient, args: z.infer<typeof searchTagsSchema>) {
  try {
    const input = searchTagsSchema.parse(args);
    const tags = await client.searchTags(input.query);
    return successResponse({ query: input.query, tags, count: tags.length });
  } catch (error) {
    return handleToolError(error, 'wikijs_search_tags');
  }
}
