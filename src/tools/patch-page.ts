/** wikijs_patch_page: guarded, exact-match text replacement. */
import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { patchPageSchema } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const patchPageToolDefinition = {
  name: 'wikijs_patch_page',
  description: `Safely replace exactly one occurrence of text in a Wiki.js page.
The current full source is read first. The operation fails without mutation when the expected text is absent or occurs more than once, preventing accidental overwrites after concurrent edits.`,
  inputSchema: patchPageSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
};

export async function handlePatchPage(client: WikiJsClient, args: z.infer<typeof patchPageSchema>) {
  try {
    const input = patchPageSchema.parse(args);
    if (!input.id && !input.path) throw new Error('Either "id" or "path" must be provided');

    const page = input.id
      ? await client.getPageById(input.id, false)
      : await client.getPageByPath(input.path!, input.locale, false);
    if (!page) throw new Error(`Page not found${input.path ? ` at path: ${input.path}` : ` with ID: ${input.id}`}`);
    if (!page.content) throw new Error(`Page ${page.id} has no readable source content`);

    const first = page.content.indexOf(input.expectedOldText);
    if (first < 0) throw new Error('Expected old text was not found; no changes were made');
    if (page.content.indexOf(input.expectedOldText, first + input.expectedOldText.length) >= 0) {
      throw new Error('Expected old text matched multiple locations; no changes were made');
    }

    const content = page.content.slice(0, first) + input.replacement + page.content.slice(first + input.expectedOldText.length);
    if (input.dryRun) {
      return successResponse({
        pageId: page.id,
        dryRun: true,
        applied: false,
        replacedCharacters: input.expectedOldText.length,
        originalContent: page.content,
        proposedContent: content,
      });
    }

    const result = await client.updatePage({
      id: page.id,
      content,
      title: page.title,
      description: page.description,
      isPublished: page.isPublished,
      tags: page.tags ?? [],
    });
    return successResponse({ pageId: page.id, dryRun: false, applied: true, replacedCharacters: input.expectedOldText.length, result });
  } catch (error) {
    return handleToolError(error, 'wikijs_patch_page');
  }
}
