import { z } from 'zod';
import type { WikiJsClient } from '../services/client.js';
import { pageCssSchema, updatePageCssSchema } from '../schemas/index.js';
import { handleToolError, successResponse } from '../services/error-handler.js';

export const getPageCssToolDefinition = { name: 'wikijs_get_page_css', description: 'Read page-specific Wiki.js CSS.', inputSchema: pageCssSchema, annotations: { readOnlyHint: true } };
export const updatePageCssToolDefinition = { name: 'wikijs_update_page_css', description: 'Preview (default) or replace page-specific CSS, optionally requiring expectedCss to match.', inputSchema: updatePageCssSchema, annotations: { readOnlyHint: false, destructiveHint: true } };

async function get(client: WikiJsClient, input: { id?: number; path?: string; locale: string }) {
  if ((input.id === undefined) === (input.path === undefined)) throw new Error('Specify exactly one page ID or path');
  const page = input.id !== undefined ? await client.getPageById(input.id, false) : await client.getPageByPath(input.path!, input.locale, false);
  if (!page) throw new Error('Page not found');
  if (page.scriptCss == null) throw new Error('Page CSS is not readable; check permissions');
  return page;
}
export async function handleGetPageCss(client: WikiJsClient, args: z.infer<typeof pageCssSchema>) {
  try { const page = await get(client, pageCssSchema.parse(args)); return successResponse({ pageId: page.id, css: page.scriptCss }); }
  catch (e) { return handleToolError(e, 'wikijs_get_page_css'); }
}
export async function handleUpdatePageCss(client: WikiJsClient, args: z.infer<typeof updatePageCssSchema>) {
  try {
    const input = updatePageCssSchema.parse(args);
    const page = await get(client, input);
    const previousCss = page.scriptCss!;
    if (input.expectedCss !== undefined && input.expectedCss !== previousCss) throw new Error('CSS does not match expectedCss');
    if (input.dryRun || previousCss === input.css) return successResponse({ pageId: page.id, dryRun: input.dryRun, applied: false, previousCss, proposedCss: input.css });
    const result = await client.updatePage({ id: page.id, scriptCss: input.css, expectedScriptCss: previousCss });
    const verified = await client.getPageById(page.id, false);
    if (!verified || verified.scriptCss !== input.css) throw new Error('CSS update was not verified; check write:styles permission');
    return successResponse({ pageId: page.id, dryRun: false, applied: true, previousCss, proposedCss: input.css, result });
  } catch (e) { return handleToolError(e, 'wikijs_update_page_css'); }
}
