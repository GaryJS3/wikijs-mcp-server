#!/usr/bin/env node

import { loadConfig, loadEnvironment } from './config.js';
import { WikiJsClient } from './services/client.js';
import { createServer } from './server/createServer.js';
import { startHttpServer } from './server/http.js';
import { startStdioServer } from './server/stdio.js';

loadEnvironment();

// Graceful shutdown handling
let isShuttingDown = false;
let httpServer: import('node:http').Server | undefined;
let mcpServer: import('@modelcontextprotocol/sdk/server/mcp.js').McpServer | undefined;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error(`Received ${signal}, shutting down gracefully...`);
  try {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    }
    if (mcpServer) await mcpServer.close();
    console.error('Wiki.js MCP Server shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Setup signal handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error: Error & { code?: string }) => {
  // Don't log EPIPE errors (broken pipe when client disconnects)
  if (error.code !== 'EPIPE') {
    console.error('Uncaught exception:', error);
  }
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  shutdown('unhandledRejection');
});

// Start server
async function main(): Promise<void> {
  const config = loadConfig();
  const wikiClient = new WikiJsClient(config.wikiJsApiUrl, config.wikiJsApiToken);
  const factory = (): import('@modelcontextprotocol/sdk/server/mcp.js').McpServer => createServer(wikiClient);

  if (config.transport === 'http') {
    httpServer = await startHttpServer(config, factory);
  } else {
    mcpServer = factory();
    await startStdioServer(mcpServer, config.wikiJsApiUrl);
  }
}

main().catch((error) => {
  console.error('Server startup failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
