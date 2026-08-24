import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from '../src/server/createServer.js';
import { createHttpServer } from '../src/server/http.js';
import type { ServerConfig } from '../src/config.js';
import type { WikiJsClient } from '../src/services/client.js';

const fakeClient = {
  getPageById: async () => ({
    id: 42,
    path: 'test/page',
    title: 'Test page',
    description: 'A test page',
    content: '# Test content',
    contentType: 'markdown',
    isPublished: true,
    locale: 'en',
  }),
} as unknown as WikiJsClient;

const config: ServerConfig = {
  transport: 'http',
  wikiJsApiUrl: 'https://wiki.example/graphql',
  wikiJsApiToken: 'not-used-in-test',
  httpHost: '127.0.0.1',
  httpPort: 0,
  mcpPath: '/mcp',
  mcpAuthToken: 'test-token',
  allowedHosts: ['127.0.0.1'],
  allowedOrigins: [],
};

function listen(server: Server): Promise<{ server: Server; url: string }> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Test server did not expose a TCP address'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('Streamable HTTP transport', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    ({ server, url: baseUrl } = await listen(createHttpServer(config, () => createServer(fakeClient))));
  });

  afterAll(async () => close(server));

  it('returns a small unauthenticated health response', async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service: 'wikijs-mcp-server', version: '2.1.0' });
  });

  it('rejects missing and invalid bearer tokens', async () => {
    const request = { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' };
    expect((await fetch(`${baseUrl}/mcp`, request)).status).toBe(401);
    expect((await fetch(`${baseUrl}/mcp`, { ...request, headers: { ...request.headers, authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  it('lists all tools and invokes a read-only tool through MCP HTTP', async () => {
    const client = new Client({ name: 'transport-test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: 'Bearer test-token' } },
    });

    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      'wikijs_create_page',
      'wikijs_get_page',
      'wikijs_list_pages',
      'wikijs_search_pages',
      'wikijs_update_page',
      'wikijs_delete_page',
      'wikijs_move_page',
      'wikijs_get_tree',
      'wikijs_list_tags',
      'wikijs_search_tags',
      'wikijs_page_history',
      'wikijs_get_page_version',
      'wikijs_restore_page_version',
      'wikijs_patch_page',
    ]);
    expect(tools.tools.every((tool) => tool.outputSchema)).toBe(true);

    const result = await client.callTool({ name: 'wikijs_get_page', arguments: { id: 42 } });
    expect(result.isError).not.toBe(true);
    expect(JSON.parse((result.content[0] as { text: string }).text).page.title).toBe('Test page');
    expect(result.structuredContent).toMatchObject({ success: true, page: { title: 'Test page' } });
    await client.close();
  });

  it('handles malformed MCP requests without exposing server details', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain('not-used-in-test');
  });

  it('allows MCP requests when bearer authentication is disabled', async () => {
    const noAuthServer = await listen(createHttpServer({ ...config, mcpAuthToken: undefined }, () => createServer(fakeClient)));
    try {
      const response = await fetch(`${noAuthServer.url}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      expect(response.status).not.toBe(401);
    } finally {
      await close(noAuthServer.server);
    }
  });
});
