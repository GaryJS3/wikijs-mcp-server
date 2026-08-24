/**
 * Zod Schemas for Wiki.js MCP Server Tools
 *
 * All input validation schemas with proper constraints and descriptions
 */

import { z } from 'zod';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, MAX_CONTENT_SIZE, MAX_TAG_LENGTH, MAX_TAGS_PER_PAGE } from '../constants.js';

// Common schemas
const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Locale must be a valid language code (e.g., "en", "de", "en-US")')
  .default('en')
  .describe('Page locale (e.g., "en", "de")');

const pageIdSchema = z
  .number()
  .int()
  .positive()
  .describe('Page ID (positive integer)');

const pagePathSchema = z
  .string()
  .min(1)
  .max(500)
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9\-_/]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
    'Path must contain only alphanumeric characters, hyphens, underscores, and forward slashes'
  )
  .refine(
    (path) => !path.includes('..') && !path.includes('//'),
    'Path must not contain ".." or "//"'
  )
  .describe('Page path without leading slash (e.g., "osticket/plugin-name" or "home")');

const tagSchema = z
  .string()
  .min(1)
  .max(MAX_TAG_LENGTH, `Tag must not exceed ${MAX_TAG_LENGTH} characters`);

const tagsSchema = z
  .array(tagSchema)
  .max(MAX_TAGS_PER_PAGE, `Maximum ${MAX_TAGS_PER_PAGE} tags per page`);

const contentSchema = z
  .string()
  .min(1)
  .max(MAX_CONTENT_SIZE, `Content must not exceed ${MAX_CONTENT_SIZE} characters`);

// Create Page Schema
export const createPageSchema = z.object({
  path: pagePathSchema,
  title: z
    .string()
    .min(1)
    .max(200)
    .describe('Page title'),
  content: contentSchema
    .describe('Page content (Markdown or HTML depending on editor)'),
  description: z
    .string()
    .min(1)
    .max(500)
    .describe('Short page description (meta description)'),
  locale: localeSchema,
  editor: z
    .enum(['markdown', 'code', 'ckeditor'])
    .default('markdown')
    .describe('Editor type: "markdown" (default), "code" (raw HTML), or "ckeditor" (visual)'),
  isPublished: z
    .boolean()
    .default(true)
    .describe('Whether the page should be published immediately'),
  isPrivate: z
    .boolean()
    .default(false)
    .describe('Whether the page should be private (restricted access)'),
  tags: tagsSchema
    .default([])
    .describe('Array of tags for the page (e.g., ["tutorial", "development"])'),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

// Note: id/path mutex is enforced in handlers, not via .refine(),
// because MCP SDK server.tool() requires .shape which is only on ZodObject.

// Update Page Schema
export const updatePageSchema = z.object({
  id: pageIdSchema.optional().describe('Page ID to update (optional if path is provided)'),
  path: pagePathSchema.optional().describe('Page path (optional if id is provided)'),
  locale: localeSchema,
  content: contentSchema.optional().describe('New page content (optional)'),
  title: z.string().max(200).optional().describe('New page title (optional)'),
  description: z.string().max(500).optional().describe('New page description (optional)'),
  isPublished: z.boolean().optional().describe('Whether the page should be published (optional)'),
  tags: tagsSchema.optional().describe('Array of tags for the page (optional)'),
});

export type UpdatePageInput = z.infer<typeof updatePageSchema>;

// Get Page Schema
export const getPageSchema = z.object({
  id: pageIdSchema.optional().describe('Page ID (optional if path is provided)'),
  path: pagePathSchema.optional().describe('Page path (optional if id is provided)'),
  locale: localeSchema,
});

export type GetPageInput = z.infer<typeof getPageSchema>;

// List Pages Schema
export const listPagesSchema = z.object({
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Locale must be a valid language code')
    .optional()
    .describe('Filter by locale (optional, e.g., "en", "de")'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_LIMIT)
    .default(DEFAULT_PAGE_LIMIT)
    .describe(`Maximum number of pages to return (default: ${DEFAULT_PAGE_LIMIT}, max: ${MAX_PAGE_LIMIT})`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of pages to skip for pagination (default: 0)'),
});

export type ListPagesInput = z.infer<typeof listPagesSchema>;

// Search Pages Schema
export const searchPagesSchema = z.object({
  query: z
    .string()
    .min(2)
    .max(200)
    .describe('Search query string (minimum 2 characters)'),
  locale: z
    .string()
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Locale must be a valid language code')
    .optional()
    .describe('Filter results by locale (optional)'),
});

export type SearchPagesInput = z.infer<typeof searchPagesSchema>;

// Delete Page Schema
export const deletePageSchema = z.object({
  id: pageIdSchema.optional().describe('Page ID to delete (optional if path is provided)'),
  path: pagePathSchema.optional().describe('Page path (optional if id is provided)'),
  locale: localeSchema,
});

export type DeletePageInput = z.infer<typeof deletePageSchema>;

// Move Page Schema
export const movePageSchema = z.object({
  id: pageIdSchema.optional().describe('Page ID to move (optional if path is provided)'),
  path: pagePathSchema.optional().describe('Current page path (optional if id is provided)'),
  locale: localeSchema,
  destinationPath: pagePathSchema
    .describe('New path for the page (e.g., "new-category/page-name")'),
  destinationLocale: localeSchema.describe('Target locale (e.g., "en", "de")'),
});

export type MovePageInput = z.infer<typeof movePageSchema>;

// Page tree schema
export const pageTreeSchema = z.object({
  path: pagePathSchema.optional().describe('Optional tree path to browse'),
  parent: pageIdSchema.optional().describe('Optional parent page ID'),
  mode: z.enum(['FOLDERS', 'PAGES', 'ALL']).default('ALL').describe('Tree nodes to return'),
  locale: localeSchema,
  includeAncestors: z.boolean().default(false).describe('Include ancestors of the requested path'),
});

export type PageTreeInput = z.infer<typeof pageTreeSchema>;

// Tag discovery schemas
export const listTagsSchema = z.object({});
export const searchTagsSchema = z.object({
  query: z.string().min(1).max(100).describe('Tag prefix or search text'),
});

export type SearchTagsInput = z.infer<typeof searchTagsSchema>;

// Revision schemas
export const pageHistorySchema = z.object({
  id: pageIdSchema,
  offsetPage: z.number().int().min(0).default(0).describe('Revision page offset'),
  offsetSize: z.number().int().min(1).max(100).default(20).describe('Maximum revisions to return'),
});

export type PageHistoryInput = z.infer<typeof pageHistorySchema>;

export const pageVersionSchema = z.object({
  pageId: pageIdSchema,
  versionId: pageIdSchema,
});

export type PageVersionInput = z.infer<typeof pageVersionSchema>;

// Safe text replacement schema
export const patchPageSchema = z.object({
  id: pageIdSchema.optional().describe('Page ID (optional if path is provided)'),
  path: pagePathSchema.optional().describe('Page path (optional if id is provided)'),
  locale: localeSchema,
  expectedOldText: z.string().min(1).max(MAX_CONTENT_SIZE).describe('Text that must occur exactly once in the current page'),
  replacement: z.string().max(MAX_CONTENT_SIZE).describe('Replacement text; may be empty to remove the matched text'),
  dryRun: z.boolean().default(true).describe('Preview the replacement without changing Wiki.js (default: true)'),
});

export type PatchPageInput = z.infer<typeof patchPageSchema>;

export const restorePageVersionSchema = z.object({
  pageId: pageIdSchema,
  versionId: pageIdSchema,
  confirm: z.literal(true).describe('Must be true to acknowledge that restoring changes the live page'),
  dryRun: z.boolean().default(true).describe('Preview the revision without restoring it (default: true)'),
});

export type RestorePageVersionInput = z.infer<typeof restorePageVersionSchema>;
