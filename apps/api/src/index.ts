import { createApp } from './app';
import { env } from './config/appConfig';

const app = createApp();

app.listen(env.port, () => {
  console.log(`[Overthinker Image AI API] listening on http://localhost:${env.port}`);
  console.log(`[Storage Root] ${env.storageRoot}`);
});
