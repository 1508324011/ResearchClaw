import { getServerConfig } from './config/server-config';
import { startResearchClawServer } from './index';

async function main() {
  const config = getServerConfig();
  const server = await startResearchClawServer(config);

  const shutdown = () => {
    server.close((error) => {
      if (error) {
        process.exitCode = 1;
        console.error('Failed to stop ResearchClaw web server cleanly:', error);
      }
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`ResearchClaw web server listening on http://${config.host}:${config.port}`);
}

main().catch((error) => {
  console.error('Failed to start ResearchClaw web server:', error);
  process.exitCode = 1;
});
