/**
 * wikijs_create_page Tool
 *
 * Creates a new page in Wiki.js
 */

import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { createPageSchema, type CreatePageInput } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const createPageToolDefinition = {
  name: 'wikijs_create_page',
  description: `Create a new page in Wiki.js with markdown or HTML content.

This tool creates a new page at the specified path. If a page already exists at that path, the operation will fail.

Args:
  - path (string, required): Page path without leading slash (e.g., "osticket/plugin-name")
  - title (string, required): Page title (max 200 chars)
  - content (string, required): Page content in markdown or HTML
  - description (string, required): Meta description (max 500 chars)
  - locale (string): Page locale, default "en"
  - editor (enum): "markdown" (default), "code", or "ckeditor"
  - isPublished (boolean): Publish immediately, default true
  - isPrivate (boolean): Private page, default false
  - tags (array): Tags for categorization

Returns:
  Created page info with ID, path, title, and URL

Examples:
  - Create docs page: path="docs/api", title="API Reference", content="# API..."
  - Create private draft: path="drafts/idea", isPublished=false, isPrivate=true`,
  inputSchema: createPageSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export async function handleCreatePage(
  client: WikiJsClient,
  args: z.infer<typeof createPageSchema>
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    // Validate input with Zod
    const validated: CreatePageInput = createPageSchema.parse(args);

    const page = await client.createPage({
      path: validated.path,
      title: validated.title,
      content: validated.content,
      description: validated.description,
      locale: validated.locale,
      editor: validated.editor,
      isPublished: validated.isPublished,
      isPrivate: validated.isPrivate,
      tags: validated.tags,
      scriptCss: validated.scriptCss,
    });

    return successResponse({
      message: `Page created successfully at /${validated.path}`,
      page: {
        id: page.id,
        path: page.path,
        title: page.title,
      },
    });
  } catch (error) {
    return handleToolError(error, 'wikijs_create_page');
  }
}
