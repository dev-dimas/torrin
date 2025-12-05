import { Module } from "@nestjs/common";
import { TorrinModule, TorrinService } from "@torrin/server-nestjs";
import { createLocalStorageDriver } from "@torrin/storage-local";
import { createInMemoryStore } from "@torrin/server";
import { HealthController } from "./health.controller";
import { AdminController } from "./admin.controller";

// Upload TTL: 1 hour (for demo purposes, use 24 hours in production)
export const UPLOAD_TTL_MS = 60 * 60 * 1000;

// Cleanup interval: every 10 minutes
export const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const storage = createLocalStorageDriver({
  baseDir: "./uploads",
});

const store = createInMemoryStore();

// Create service instance for cleanup access
let torrinServiceInstance: TorrinService | null = null;

export function getTorrinService(): TorrinService | null {
  return torrinServiceInstance;
}

@Module({
  imports: [
    TorrinModule.forRoot({
      storage,
      store,
      defaultChunkSize: 1024 * 1024, // 1MB chunks
      uploadTtlMs: UPLOAD_TTL_MS,
    }),
  ],
  controllers: [HealthController, AdminController],
  providers: [
    {
      provide: "TORRIN_SERVICE_INIT",
      useFactory: () => {
        torrinServiceInstance = new TorrinService({
          storage,
          store,
          defaultChunkSize: 1024 * 1024,
          uploadTtlMs: UPLOAD_TTL_MS,
        });
        return torrinServiceInstance;
      },
    },
  ],
})
export class AppModule {}
