import app from './app';
import { env } from './config/env';
import { testConnection } from './config/db';

async function start() {
  try {
    await testConnection();
    app.listen(env.port, () => {
      // eslint-disable-next-line no-console
      console.log(`[server] Mini ERP + CRM API listening on port ${env.port} (${env.nodeEnv})`);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();
