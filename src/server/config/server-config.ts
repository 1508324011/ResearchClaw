import { getConfiguredStorageDir } from '../../main/store/storage-path';

export const SERVER_MODE = 'single-user-first' as const;

export interface ServerConfig {
  host: string;
  port: number;
  mode: typeof SERVER_MODE;
  storageDir: string;
}

function parsePort(value: string | undefined): number {
  if (!value) return 3456;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3456;
}

export function getServerConfig(): ServerConfig {
  return {
    host: process.env.RESEARCH_CLAW_HOST || '127.0.0.1',
    port: parsePort(process.env.PORT),
    mode: SERVER_MODE,
    storageDir: getConfiguredStorageDir(),
  };
}
