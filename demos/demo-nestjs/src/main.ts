import { NestFactory } from "@nestjs/core";
import { AppModule, getTorrinService, UPLOAD_TTL_MS, CLEANUP_INTERVAL_MS } from "./app.module";

const PORT = 3001;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  
  // Start periodic cleanup
  const torrinService = getTorrinService();
  if (torrinService) {
    setInterval(async () => {
      const result = await torrinService.cleanupExpiredUploads();
      if (result.cleaned > 0) {
        console.log(`[CLEANUP] Automatically cleaned ${result.cleaned} expired uploads`);
      }
      if (result.errors.length > 0) {
        console.log(`[CLEANUP] Errors:`, result.errors);
      }
    }, CLEANUP_INTERVAL_MS);
  }
  
  await app.listen(PORT);
  
  console.log(`
🚀 NestJS Demo Server running!
   
   Health:  http://localhost:${PORT}/health
   Torrin:  http://localhost:${PORT}/torrin/uploads
   Cleanup: POST http://localhost:${PORT}/admin/cleanup
   
   Uploads will be saved to: ./uploads
   Upload TTL: ${UPLOAD_TTL_MS / 1000 / 60} minutes
   Auto cleanup every: ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes
`);
}

bootstrap();
