import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WikiJsClient } from '../services/client.js';
import {
  createPageToolDefinition,
  handleCreatePage,
  getPageToolDefinition,
  handleGetPage,
  listPagesToolDefinition,
  handleListPages,
  searchPagesToolDefinition,
  handleSearchPages,
  updatePageToolDefinition,
  handleUpdatePage,
  deletePageToolDefinition,
  handleDeletePage,
  movePageToolDefinition,
  handleMovePage,
  getTreeToolDefinition,
  handleGetTree,
  listTagsToolDefinition,
  handleListTags,
  searchTagsToolDefinition,
  handleSearchTags,
  pageHistoryToolDefinition,
  handlePageHistory,
  pageVersionToolDefinition,
  handlePageVersion,
  restorePageVersionToolDefinition,
  handleRestorePageVersion,
  patchPageToolDefinition,
  handlePatchPage,
} from '../tools/index.js';
import {
  createPageOutputSchema,
  getPageOutputSchema,
  listPagesOutputSchema,
  searchPagesOutputSchema,
  updatePageOutputSchema,
  deletePageOutputSchema,
  movePageOutputSchema,
  getTreeOutputSchema,
  listTagsOutputSchema,
  searchTagsOutputSchema,
  pageHistoryOutputSchema,
  pageVersionOutputSchema,
  restorePageVersionOutputSchema,
  patchPageOutputSchema,
} from '../schemas/outputs.js';

export const SERVER_NAME = 'wikijs-mcp-server';
export const SERVER_VERSION = '2.1.0';

/** Create the common MCP server independently of the transport used to host it. */
export function createServer(wikiClient: WikiJsClient): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(createPageToolDefinition.name, { description: createPageToolDefinition.description, inputSchema: createPageToolDefinition.inputSchema, outputSchema: createPageOutputSchema, annotations: createPageToolDefinition.annotations }, async (args) => handleCreatePage(wikiClient, args));
  server.registerTool(getPageToolDefinition.name, { description: getPageToolDefinition.description, inputSchema: getPageToolDefinition.inputSchema, outputSchema: getPageOutputSchema, annotations: getPageToolDefinition.annotations }, async (args) => handleGetPage(wikiClient, args));
  server.registerTool(listPagesToolDefinition.name, { description: listPagesToolDefinition.description, inputSchema: listPagesToolDefinition.inputSchema, outputSchema: listPagesOutputSchema, annotations: listPagesToolDefinition.annotations }, async (args) => handleListPages(wikiClient, args));
  server.registerTool(searchPagesToolDefinition.name, { description: searchPagesToolDefinition.description, inputSchema: searchPagesToolDefinition.inputSchema, outputSchema: searchPagesOutputSchema, annotations: searchPagesToolDefinition.annotations }, async (args) => handleSearchPages(wikiClient, args));
  server.registerTool(updatePageToolDefinition.name, { description: updatePageToolDefinition.description, inputSchema: updatePageToolDefinition.inputSchema, outputSchema: updatePageOutputSchema, annotations: updatePageToolDefinition.annotations }, async (args) => handleUpdatePage(wikiClient, args));
  server.registerTool(deletePageToolDefinition.name, { description: deletePageToolDefinition.description, inputSchema: deletePageToolDefinition.inputSchema, outputSchema: deletePageOutputSchema, annotations: deletePageToolDefinition.annotations }, async (args) => handleDeletePage(wikiClient, args));
  server.registerTool(movePageToolDefinition.name, { description: movePageToolDefinition.description, inputSchema: movePageToolDefinition.inputSchema, outputSchema: movePageOutputSchema, annotations: movePageToolDefinition.annotations }, async (args) => handleMovePage(wikiClient, args));
  server.registerTool(getTreeToolDefinition.name, { description: getTreeToolDefinition.description, inputSchema: getTreeToolDefinition.inputSchema, outputSchema: getTreeOutputSchema, annotations: getTreeToolDefinition.annotations }, async (args) => handleGetTree(wikiClient, args));
  server.registerTool(listTagsToolDefinition.name, { description: listTagsToolDefinition.description, inputSchema: listTagsToolDefinition.inputSchema, outputSchema: listTagsOutputSchema, annotations: listTagsToolDefinition.annotations }, async (args) => handleListTags(wikiClient, args));
  server.registerTool(searchTagsToolDefinition.name, { description: searchTagsToolDefinition.description, inputSchema: searchTagsToolDefinition.inputSchema, outputSchema: searchTagsOutputSchema, annotations: searchTagsToolDefinition.annotations }, async (args) => handleSearchTags(wikiClient, args));
  server.registerTool(pageHistoryToolDefinition.name, { description: pageHistoryToolDefinition.description, inputSchema: pageHistoryToolDefinition.inputSchema, outputSchema: pageHistoryOutputSchema, annotations: pageHistoryToolDefinition.annotations }, async (args) => handlePageHistory(wikiClient, args));
  server.registerTool(pageVersionToolDefinition.name, { description: pageVersionToolDefinition.description, inputSchema: pageVersionToolDefinition.inputSchema, outputSchema: pageVersionOutputSchema, annotations: pageVersionToolDefinition.annotations }, async (args) => handlePageVersion(wikiClient, args));
  server.registerTool(restorePageVersionToolDefinition.name, { description: restorePageVersionToolDefinition.description, inputSchema: restorePageVersionToolDefinition.inputSchema, outputSchema: restorePageVersionOutputSchema, annotations: restorePageVersionToolDefinition.annotations }, async (args) => handleRestorePageVersion(wikiClient, args));
  server.registerTool(patchPageToolDefinition.name, { description: patchPageToolDefinition.description, inputSchema: patchPageToolDefinition.inputSchema, outputSchema: patchPageOutputSchema, annotations: patchPageToolDefinition.annotations }, async (args) => handlePatchPage(wikiClient, args));

  return server;
}
