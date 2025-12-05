# @torrin/server-nestjs

NestJS integration for Torrin upload engine.

**Size:** 7.0 KB (2.0 KB gzipped)

## Installation

```bash
npm install @torrin/server @torrin/server-nestjs @torrin/storage-local
```

## Quick Start

```typescript
import { Module } from "@nestjs/common";
import { TorrinModule } from "@torrin/server-nestjs";
import { createLocalStorageDriver } from "@torrin/storage-local";
import { createInMemoryStore } from "@torrin/server";

@Module({
  imports: [
    TorrinModule.forRoot({
      storage: createLocalStorageDriver({ baseDir: "./uploads" }),
      store: createInMemoryStore(),
    }),
  ],
})
export class AppModule {}
```

## API

### `TorrinModule.forRoot(options)`

```typescript
interface TorrinModuleOptions {
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number; // Default: 1MB
  maxChunkSize?: number; // Default: 100MB
  uploadTtlMs?: number; // Default: 24 hours
  global?: boolean; // Make module global
}
```

### `TorrinModule.forRootAsync(options)`

```typescript
interface TorrinModuleAsyncOptions {
  imports?: Type<any>[];
  useFactory: (
    ...args: any[]
  ) => TorrinModuleOptions | Promise<TorrinModuleOptions>;
  inject?: InjectionToken[];
  global?: boolean;
}
```

## Endpoints

The module registers these endpoints at `/torrin/uploads`:

| Method   | Path                                      | Description       |
| -------- | ----------------------------------------- | ----------------- |
| `POST`   | `/torrin/uploads`                         | Initialize upload |
| `PUT`    | `/torrin/uploads/:uploadId/chunks/:index` | Upload chunk      |
| `GET`    | `/torrin/uploads/:uploadId/status`        | Get upload status |
| `POST`   | `/torrin/uploads/:uploadId/complete`      | Complete upload   |
| `DELETE` | `/torrin/uploads/:uploadId`               | Abort upload      |

## Async Configuration

```typescript
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TorrinModule } from "@torrin/server-nestjs";
import { createS3StorageDriver } from "@torrin/storage-s3";
import { createInMemoryStore } from "@torrin/server";

@Module({
  imports: [
    ConfigModule.forRoot(),
    TorrinModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: createS3StorageDriver({
          bucket: config.get("S3_BUCKET"),
          region: config.get("AWS_REGION"),
        }),
        store: createInMemoryStore(),
        uploadTtlMs: 24 * 60 * 60 * 1000,
      }),
    }),
  ],
})
export class AppModule {}
```

## Injecting TorrinService

```typescript
import { Injectable } from "@nestjs/common";
import { InjectTorrin, TorrinService } from "@torrin/server-nestjs";

@Injectable()
export class UploadService {
  constructor(@InjectTorrin() private torrin: TorrinService) {}

  async getProgress(uploadId: string) {
    const status = await this.torrin.getStatus(uploadId);
    return {
      progress: status.receivedChunks.length / status.totalChunks,
      missing: status.missingChunks.length,
    };
  }

  async cancel(uploadId: string) {
    await this.torrin.abortUpload(uploadId);
  }

  async cleanup() {
    return this.torrin.cleanupExpiredUploads();
  }
}
```

## Custom Controller

Override the default controller for custom logic:

```typescript
import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { InjectTorrin, TorrinService } from "@torrin/server-nestjs";
import { AuthGuard } from "./auth.guard";

@Controller("uploads")
@UseGuards(AuthGuard)
export class CustomUploadController {
  constructor(@InjectTorrin() private torrin: TorrinService) {}

  @Post()
  async initUpload(@Body() body: any, @User() user: any) {
    return this.torrin.initUpload({
      ...body,
      metadata: { ...body.metadata, userId: user.id },
    });
  }
}
```

## Guards & Interceptors

### Global guard

```typescript
import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { TorrinModule } from "@torrin/server-nestjs";
import { AuthGuard } from "./auth.guard";

@Module({
  imports: [TorrinModule.forRoot({ ... })],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

### Global interceptor

```typescript
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { TorrinModule } from "@torrin/server-nestjs";
import { LoggingInterceptor } from "./logging.interceptor";

@Module({
  imports: [TorrinModule.forRoot({ ... })],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

## Cleanup

### Cleanup service

```typescript
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectTorrin, TorrinService } from "@torrin/server-nestjs";

@Injectable()
export class CleanupService {
  constructor(@InjectTorrin() private torrin: TorrinService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup() {
    const result = await this.torrin.cleanupExpiredUploads();
    if (result.cleaned > 0) {
      console.log(`Cleaned ${result.cleaned} expired uploads`);
    }
  }
}
```

### Cleanup controller

```typescript
import { Controller, Post } from "@nestjs/common";
import { InjectTorrin, TorrinService } from "@torrin/server-nestjs";

@Controller("admin")
export class AdminController {
  constructor(@InjectTorrin() private torrin: TorrinService) {}

  @Post("cleanup")
  async cleanup() {
    return this.torrin.cleanupExpiredUploads();
  }
}
```

## Full Example

```typescript
// app.module.ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { TorrinModule } from "@torrin/server-nestjs";
import { createLocalStorageDriver } from "@torrin/storage-local";
import { createInMemoryStore } from "@torrin/server";
import { CleanupService } from "./cleanup.service";
import { AdminController } from "./admin.controller";

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TorrinModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: createLocalStorageDriver({
          baseDir: config.get("UPLOAD_DIR", "./uploads"),
        }),
        store: createInMemoryStore(),
        uploadTtlMs: config.get("UPLOAD_TTL_MS", 3600000),
        global: true,
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [CleanupService],
})
export class AppModule {}
```

## TypeScript

```typescript
import type {
  TorrinModuleOptions,
  TorrinModuleAsyncOptions,
} from "@torrin/server-nestjs";

import { TorrinService, InjectTorrin } from "@torrin/server-nestjs";
```

## License

[Apache-2.0](LICENSE)
