import type http from 'http';
import { createResearchClawServerApp } from './app';
import { getServerConfig, type ServerConfig } from './config/server-config';

export async function startResearchClawServer(
  config: ServerConfig = getServerConfig(),
): Promise<http.Server> {
  const server = createResearchClawServerApp(config);

  await new Promise<void>((resolve, reject) => {
    const handleStartupError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off('error', handleStartupError);
      resolve();
    };

    server.once('error', handleStartupError);
    server.once('listening', handleListening);
    server.listen(config.port, config.host);
  });

  return server;
}
