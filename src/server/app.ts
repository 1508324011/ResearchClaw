import http from 'http';
import { getServerConfig, type ServerConfig } from './config/server-config';
import { handleExternalSearchRoute, isExternalSearchRoute } from './routes/external-search.routes';
import { handleHealthRoute, isHealthRoute } from './routes/health.routes';
import { handleImportRoute, isImportRoute } from './routes/import.routes';
import { handleJobsRoute, isJobsRoute } from './routes/jobs.routes';
import { handlePapersRoute, isPapersRoute } from './routes/papers.routes';
import { handleReadingRoute, isReadingRoute } from './routes/reading.routes';
import { handleSearchRoute, isSearchRoute } from './routes/search.routes';
import { handleWebRoute } from './routes/web.routes';

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

export function createResearchClawServerApp(config: ServerConfig = getServerConfig()): http.Server {
  return http.createServer(async (req, res) => {
    try {
      if (isHealthRoute(req)) {
        handleHealthRoute(res, config);
        return;
      }

      if (isImportRoute(req)) {
        await handleImportRoute(req, res);
        return;
      }

      if (isExternalSearchRoute(req)) {
        await handleExternalSearchRoute(req, res);
        return;
      }

      if (await handleWebRoute(req, res, config)) {
        return;
      }

      if (isPapersRoute(req)) {
        await handlePapersRoute(req, res);
        return;
      }

      if (isReadingRoute(req)) {
        await handleReadingRoute(req, res);
        return;
      }

      if (isSearchRoute(req)) {
        await handleSearchRoute(req, res);
        return;
      }

      if (isJobsRoute(req)) {
        handleJobsRoute(req, res);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, 500, { error: message });
    }
  });
}
