import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from './createServer.js';

export async function startStdioServer(server: McpServer, wikiJsApiUrl: string): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  console.error(`Connected to: ${new URL(wikiJsApiUrl).hostname}`);
}
