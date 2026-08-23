import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import dotenv from 'dotenv';

export type TransportKind = 'stdio' | 'http';

export interface ServerConfig {
  transport: TransportKind;
  wikiJsApiUrl: string;
  wikiJsApiToken: string;
  httpHost: string;
  httpPort: number;
  mcpPath: string;
  mcpAuthToken?: string;
  allowedHosts: string[];
  allowedOrigins: string[];
}

/** Load the deployment-directory .env first, then fall back to the current directory. */
export function loadEnvironment(env: NodeJS.ProcessEnv = process.env): void {
  const envPath = join(homedir(), '.claude', 'mcp-servers', 'wikijs', '.env');
  dotenv.config(existsSync(envPath) ? { path: envPath } : undefined);

  // Tests and embedders may provide an explicit environment object. Do not mutate it.
  if (env !== process.env) {
    const values = Object.fromEntries(
      Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
    );
    dotenv.config({ processEnv: values });
  }
}

function parseList(value: string | undefined): string[] {
  return value
    ? value.split(',').map((item) => item.trim()).filter(Boolean)
    : [];
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3200');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('HTTP_PORT must be an integer between 1 and 65535');
  }
  return port;
}

function normalizeMcpPath(value: string | undefined): string {
  const path = value ?? '/mcp';
  if (!path.startsWith('/') || path.length > 200 || path.includes('?') || path.includes('#')) {
    throw new Error('MCP_PATH must be an absolute URL path without a query or fragment');
  }
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const transport = (env.TRANSPORT ?? 'stdio').toLowerCase();
  if (transport !== 'stdio' && transport !== 'http') {
    throw new Error('TRANSPORT must be either "stdio" or "http"');
  }

  const wikiJsApiUrl = env.WIKIJS_API_URL;
  const wikiJsApiToken = env.WIKIJS_API_TOKEN;
  if (!wikiJsApiUrl || !wikiJsApiToken) {
    throw new Error('Missing required environment variables WIKIJS_API_URL and WIKIJS_API_TOKEN');
  }

  try {
    new URL(wikiJsApiUrl);
  } catch {
    throw new Error('WIKIJS_API_URL must be a valid URL');
  }

  return {
    transport,
    wikiJsApiUrl,
    wikiJsApiToken,
    httpHost: env.HTTP_HOST ?? '127.0.0.1',
    httpPort: parsePort(env.HTTP_PORT),
    mcpPath: normalizeMcpPath(env.MCP_PATH),
    mcpAuthToken: env.MCP_AUTH_TOKEN || undefined,
    allowedHosts: parseList(env.MCP_ALLOWED_HOSTS),
    allowedOrigins: parseList(env.MCP_ALLOWED_ORIGINS),
  };
}
