import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getPrismaClient } from './client';
import { initSchemaWithRawSql } from './init-schema';
import { ensureStorageDir, getDbPath, getStorageDir } from '../main/store/storage-path';

const PRISMA_BIN = process.platform === 'win32' ? 'prisma.cmd' : 'prisma';

async function dropDerivedIndexTablesForPrisma(): Promise<void> {
  const prisma = getPrismaClient();
  const tables = [
    'vec_chunks',
    'vec_chunks_chunks',
    'vec_chunks_info',
    'vec_chunks_rowids',
    'vec_chunks_vector_chunks00',
    'vec_search_units',
    'vec_search_units_chunks',
    'vec_search_units_info',
    'vec_search_units_rowids',
    'vec_search_units_vector_chunks00',
    'paper_search_units_fts',
    'paper_search_units_fts_config',
    'paper_search_units_fts_content',
    'paper_search_units_fts_data',
    'paper_search_units_fts_docsize',
    'paper_search_units_fts_idx',
    'vec_meta',
  ];

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${table}`);
    } catch (error) {
      console.warn(`[ensureDatabase] Failed to drop derived table ${table}:`, error);
    }
  }
}

function getSchemaHash(schemaPath: string): string {
  const content = fs.readFileSync(schemaPath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function getSchemaHashPath(): string {
  return path.join(getStorageDir(), 'schema-hash.json');
}

function getSavedSchemaHash(): string | null {
  try {
    const hashPath = getSchemaHashPath();
    if (!fs.existsSync(hashPath)) {
      return null;
    }

    const data = JSON.parse(fs.readFileSync(hashPath, 'utf-8')) as { hash?: unknown };
    return typeof data.hash === 'string' ? data.hash : null;
  } catch {
    return null;
  }
}

function saveSchemaHash(hash: string): void {
  const hashPath = getSchemaHashPath();
  fs.writeFileSync(hashPath, JSON.stringify({ hash }), 'utf-8');
}

function findExistingPath(candidates: string[]): string | null {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function getPrismaCliPath(): string | null {
  return findExistingPath([
    path.join(process.cwd(), `node_modules/.bin/${PRISMA_BIN}`),
    path.join(__dirname, `../../node_modules/.bin/${PRISMA_BIN}`),
    path.join(process.resourcesPath ?? '', `node_modules/.bin/${PRISMA_BIN}`),
  ]);
}

function getSchemaPath(): string | null {
  return findExistingPath([
    path.join(process.cwd(), 'prisma/schema.prisma'),
    path.join(__dirname, '../../prisma/schema.prisma'),
    path.join(process.resourcesPath ?? '', 'prisma/schema.prisma'),
  ]);
}

function configureDatabaseUrl(): string {
  ensureStorageDir();
  const dbPath = getDbPath();
  process.env.DATABASE_URL ??= `file:${dbPath}`;
  return dbPath;
}

async function hasCorePaperTable(): Promise<boolean> {
  const prisma = getPrismaClient();

  try {
    const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'Paper' LIMIT 1",
    );

    return tables.length > 0;
  } catch (error) {
    console.warn('[ensureDatabase] Failed to verify core tables before skip check:', error);
    return false;
  }
}

async function runDbPush(prismaPath: string, schemaPath: string): Promise<void> {
  await dropDerivedIndexTablesForPrisma();

  const prismaEnv = {
    ...process.env,
  };
  delete prismaEnv.RUST_LOG;

  execFileSync(
    prismaPath,
    ['db', 'push', '--schema', schemaPath, '--skip-generate', '--accept-data-loss'],
    {
      env: prismaEnv,
      stdio: 'pipe',
    },
  );
}

function removeStaleJournalFiles(dbPath: string): void {
  const walPath = `${dbPath}-wal`;
  const journalPath = `${dbPath}-journal`;

  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
    console.log('[ensureDatabase] Removed stale WAL file');
  }

  if (fs.existsSync(journalPath)) {
    fs.unlinkSync(journalPath);
    console.log('[ensureDatabase] Removed stale journal file');
  }
}

export async function ensureDatabaseInitialized(): Promise<void> {
  const dbPath = configureDatabaseUrl();

  try {
    const prismaPath = getPrismaCliPath();
    const schemaPath = getSchemaPath();

    if (!prismaPath || !schemaPath) {
      console.log('[ensureDatabase] Prisma CLI not found, falling back to raw SQL initialization');
      await initSchemaWithRawSql();
      return;
    }

    const currentHash = getSchemaHash(schemaPath);
    const savedHash = getSavedSchemaHash();
    const hasPaperTable = await hasCorePaperTable();

    if (currentHash === savedHash && fs.existsSync(dbPath) && hasPaperTable) {
      console.log('[ensureDatabase] Schema unchanged, skipping db push');
      return;
    }

    console.log('[ensureDatabase] Schema changed or database missing, running db push...');

    try {
      await runDbPush(prismaPath, schemaPath);
      saveSchemaHash(currentHash);
      console.log('[ensureDatabase] db push completed successfully');
    } catch (dbPushError) {
      console.error('[ensureDatabase] db push failed, attempting recovery:', dbPushError);

      try {
        removeStaleJournalFiles(dbPath);
        await runDbPush(prismaPath, schemaPath);
        saveSchemaHash(currentHash);
        console.log('[ensureDatabase] db push completed after recovery');
      } catch (retryError) {
        console.error('[ensureDatabase] Recovery failed, falling back to raw SQL initialization');
        await initSchemaWithRawSql();
        saveSchemaHash(currentHash);
      }
    }
  } catch (error) {
    console.error('[ensureDatabase] Failed to initialize database:', error);

    try {
      await initSchemaWithRawSql();
      console.log('[ensureDatabase] Raw SQL initialization completed as fallback');
    } catch (fallbackError) {
      console.error('[ensureDatabase] All database initialization attempts failed:', fallbackError);
      throw fallbackError;
    }
  }
}
