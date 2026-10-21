/**
 * wikijs_update_page Tool
 *
 * Updates an existing page in Wiki.js
 */

import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { updatePageSchema, type UpdatePageInput } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const updatePageToolDefinition = {
  name: 'wikijs_update_page',
  description: `Update an existing page in Wiki.js.

Modify content, title, description, tags, or publish status of an existing page. Identify the page by ID or path+locale.

Args:
  - id (number, optional): Page ID (use this OR path)
  - path (string, optional): Page path (use this OR id)
  - locale (string): Page locale, default "en" (required with path)
  - content (string, optional): New page content
  - title (string, optional): New title (max 200 chars)
  - description (string, optional): New description (max 500 chars)
  - isPublished (boolean, optional): Publish/unpublish
  - tags (array, optional): Replace tags

Returns:
  Success confirmation with update result

Note: If you don't provide content or tags, existing values are automatically preserved.
This allows metadata-only updates (e.g., changing isPublished) without having to provide the full page content.

Examples:
  - Update content: id=42, content="# New Content..."
  - Unpublish: path="drafts/old-post", isPublished=false
  - Update tags: id=42, tags=["updated", "v2"]
  - Publish only: id=42, isPublished=true (content auto-preserved)`,
  inputSchema: updatePageSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export async function handleUpdatePage(
  client: WikiJsClient,
  args: z.infer<typeof updatePageSchema>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    // Validate input with Zod
    const validated: UpdatePageInput = updatePageSchema.parse(args);

    if (!validated.id && !validated.path) {
      throw new Error('Either "id" or "path" must be provided');
    }

    // Resolve page ID from path if needed, and optionally fetch current page data
    let pageId = validated.id;
    let currentPage = null;

    if (!pageId && validated.path) {
      currentPage = await client.getPageByPath(validated.path, validated.locale, false);
      if (!currentPage) {
        throw new Error(`Page not found at path: ${validated.path}`);
      }
      pageId = currentPage.id;
    }

    if (!pageId) {
      throw new Error('Could not resolve page ID');
    }

    // Auto-fetch current page data for fields not provided
    // Wiki.js API requires string values for title/description and content
    const needsCurrentPage =
      validated.content === undefined ||
      validated.title === undefined ||
      validated.description === undefined;

    if (needsCurrentPage && !currentPage) {
      currentPage = await client.getPageById(pageId, false);
      if (!currentPage) {
        throw new Error(`Page not found with ID: ${pageId}`);
      }
    }

    const contentToUse = validated.content ?? currentPage?.content;
    const titleToUse = validated.title ?? currentPage?.title ?? null;
    const descriptionToUse = validated.description ?? currentPage?.description ?? null;

    // If tags not provided, fetch current tags to preserve them
    // (Wiki.js API requires tags parameter in update mutation)
    let tagsToUse = validated.tags;
    if (tagsToUse === undefined) {
      const pages = await client.getAllPages();
      const foundPage = pages.find((p) => p.id === pageId);
      tagsToUse = foundPage?.tags || [];
    }

    const result = await client.updatePage({
      id: pageId,
      content: contentToUse ?? null,
      title: titleToUse,
      description: descriptionToUse,
      isPublished: validated.isPublished ?? null,
      tags: tagsToUse,
    });

    return successResponse({
      message: `Page ${pageId} updated successfully`,
      result,
    });
  } catch (error) {
    return handleToolError(error, 'wikijs_update_page');
  }
}
