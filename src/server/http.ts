import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer as nodeCreateServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../config.js';
import { SERVER_NAME, SERVER_VERSION } from './createServer.js';

export type McpServerFactory = () => McpServer;

function json(res: ServerResponse, status: number, body: unknown): void {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

function hostnameFromHostHeader(hostHeader: string | undefined): string | undefined {
  if (!hostHeader) return undefined;
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isLoopbackBind(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}

function hostAllowed(req: IncomingMessage, config: ServerConfig): boolean {
  const host = hostnameFromHostHeader(req.headers.host);
  if (!host) return false;

  const allowedHosts = config.allowedHosts.length > 0
    ? config.allowedHosts
    : isLoopbackBind(config.httpHost) ? ['localhost', '127.0.0.1', '::1'] : [];

  return allowedHosts.some((allowed) => allowed === '*' || allowed.toLowerCase() === host);
}

function originAllowed(req: IncomingMessage, config: ServerConfig): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;

  if (config.allowedOrigins.includes('*')) return true;
  if (config.allowedOrigins.length > 0) {
    return config.allowedOrigins.some((allowed) => allowed.replace(/\/$/, '') === origin.replace(/\/$/, ''));
  }

  const originHost = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  })();
  return originHost !== undefined && originHost === hostnameFromHostHeader(req.headers.host);
}

function authorized(req: IncomingMessage, token: string | undefined): boolean {
  if (!token) return true;
  const header = req.headers.authorization;
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const expected = createHash('sha256').update(token).digest();
  const actual = createHash('sha256').update(match[1]).digest();
  return timingSafeEqual(expected, actual);
}

function validateRequest(req: IncomingMessage, config: ServerConfig): string | undefined {
  if (!hostAllowed(req, config)) return 'Request host is not allowed';
  if (!originAllowed(req, config)) return 'Request origin is not allowed';
  if (!authorized(req, config.mcpAuthToken)) return 'Unauthorized';
  return undefined;
}

export function createHttpServer(config: ServerConfig, createMcpServer: McpServerFactory): Server {
  if (!isLoopbackBind(config.httpHost) && config.allowedHosts.length === 0) {
    throw new Error('MCP_ALLOWED_HOSTS must be configured when HTTP_HOST is not loopback');
  }

  const activeTransports = new Set<StreamableHTTPServerTransport>();
  const activeServers = new Set<McpServer>();

  const closeActive = async (): Promise<void> => {
    await Promise.all([...activeTransports].map((transport) => transport.close().catch(() => undefined)));
    await Promise.all([...activeServers].map((server) => server.close().catch(() => undefined)));
    activeTransports.clear();
    activeServers.clear();
  };

  const httpServer = nodeCreateServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (requestUrl.pathname === '/health' && req.method === 'GET') {
      json(res, 200, { status: 'ok', service: SERVER_NAME, version: SERVER_VERSION });
      return;
    }

    if (requestUrl.pathname !== config.mcpPath || !['POST', 'GET', 'DELETE'].includes(req.method ?? '')) {
      json(res, 404, { error: 'Not found' });
      return;
    }

    const validationError = validateRequest(req, config);
    if (validationError === 'Unauthorized') {
      res.setHeader('WWW-Authenticate', 'Bearer');
      json(res, 401, { error: validationError });
      return;
    }
    if (validationError) {
      json(res, 403, { error: validationError });
      return;
    }

    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    activeServers.add(mcpServer);
    activeTransports.add(transport);
    let cleanedUp = false;
    const cleanup = (): void => {
      if (cleanedUp) return;
      cleanedUp = true;
      activeServers.delete(mcpServer);
      activeTransports.delete(transport);
      void transport.close().catch(() => undefined);
      void mcpServer.close().catch(() => undefined);
    };
    res.once('finish', cleanup);
    res.once('close', cleanup);

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      cleanup();
      console.error('MCP request failed:', error instanceof Error ? error.message : String(error));
      json(res, 500, { error: 'Internal MCP server error' });
    }
  });

  httpServer.on('close', () => { void closeActive(); });
  httpServer.on('error', (error) => console.error('HTTP server error:', error.message));
  return httpServer;
}

export async function startHttpServer(
  config: ServerConfig,
  createMcpServer: McpServerFactory
): Promise<Server> {
  const server = createHttpServer(config, createMcpServer);
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(config.httpPort, config.httpHost);
  });
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running on HTTP`);
  console.error(`Listening on http://${config.httpHost}:${config.httpPort}${config.mcpPath}`);
  return server;
}
