import path from 'node:path';
import { getConfiguredStorageDir } from '../../main/store/storage-path';

export const SERVER_MODE = 'single-user-first' as const;
export const DEFAULT_WEB_ROOT_DIR = path.resolve(process.cwd(), 'dist/web');

export interface ServerConfig {
  host: string;
  port: number;
  mode: typeof SERVER_MODE;
  storageDir: string;
  webRootDir?: string;
}

function parsePort(value: string | undefined): number {
  if (!value) return 3456;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3456;
}

export function getServerConfig(): ServerConfig {
  return {
    host: process.env.RESEARCH_CLAW_HOST || '0.0.0.0',
    port: parsePort(process.env.PORT),
    mode: SERVER_MODE,
    storageDir: getConfiguredStorageDir(),
    webRootDir: path.resolve(process.env.RESEARCH_CLAW_WEB_ROOT_DIR || DEFAULT_WEB_ROOT_DIR),
  };
}
