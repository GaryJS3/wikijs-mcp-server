/** Wiki.js page history and immutable revision retrieval tools. */
import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { pageHistorySchema, pageVersionSchema, restorePageVersionSchema } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const pageHistoryToolDefinition = {
  name: 'wikijs_page_history',
  description: 'List the revision history of a Wiki.js page. Requires the API token to have history-read permission.',
  inputSchema: pageHistorySchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export async function handlePageHistory(client: WikiJsClient, args: z.infer<typeof pageHistorySchema>) {
  try {
    const input = pageHistorySchema.parse(args);
    const history = await client.getPageHistory(input.id, input.offsetPage, input.offsetSize);
    return successResponse({ id: input.id, ...history });
  } catch (error) {
    return handleToolError(error, 'wikijs_page_history');
  }
}

export const pageVersionToolDefinition = {
  name: 'wikijs_get_page_version',
  description: 'Retrieve the content and metadata of one immutable Wiki.js page revision. Read-only.',
  inputSchema: pageVersionSchema,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
};

export async function handlePageVersion(client: WikiJsClient, args: z.infer<typeof pageVersionSchema>) {
  try {
    const input = pageVersionSchema.parse(args);
    const version = await client.getPageVersion(input.pageId, input.versionId);
    if (!version) throw new Error(`Page version not found: page ${input.pageId}, version ${input.versionId}`);
    return successResponse({ version });
  } catch (error) {
    return handleToolError(error, 'wikijs_get_page_version');
  }
}

export const restorePageVersionToolDefinition = {
  name: 'wikijs_restore_page_version',
  description: 'Preview or restore one Wiki.js page revision. This changes the live page; confirm must be true, and dryRun defaults to true.',
  inputSchema: restorePageVersionSchema,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
};

export async function handleRestorePageVersion(client: WikiJsClient, args: z.infer<typeof restorePageVersionSchema>) {
  try {
    const input = restorePageVersionSchema.parse(args);
    const version = await client.getPageVersion(input.pageId, input.versionId);
    if (!version) throw new Error(`Page version not found: page ${input.pageId}, version ${input.versionId}`);
    if (input.dryRun) return successResponse({ pageId: input.pageId, versionId: input.versionId, dryRun: true, applied: false, version });
    const result = await client.restorePageVersion(input.pageId, input.versionId);
    return successResponse({ pageId: input.pageId, versionId: input.versionId, dryRun: false, applied: true, result });
  } catch (error) {
    return handleToolError(error, 'wikijs_restore_page_version');
  }
}
