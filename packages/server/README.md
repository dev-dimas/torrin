# @torrin/server

Core server logic for Torrin upload engine. Framework-agnostic.

**Size:** 8.9 KB (2.1 KB gzipped)

## Installation

```bash
npm install @torrin/server
```

## Overview

This package provides:

- `TorrinService` - Core upload handling logic
- `TorrinStorageDriver` - Interface for storage backends
- `TorrinUploadStore` - Interface for session persistence
- `createInMemoryStore()` - Default in-memory session store

For framework integrations, use:

- `@torrin/server-express` for Express.js
- `@torrin/server-nestjs` for NestJS

## Direct Usage

```typescript
import { TorrinService, createInMemoryStore } from "@torrin/server";
import { createLocalStorageDriver } from "@torrin/storage-local";

const service = new TorrinService({
  storage: createLocalStorageDriver({ baseDir: "./uploads" }),
  store: createInMemoryStore(),
});

// Initialize upload
const session = await service.initUpload({
  fileName: "video.mp4",
  fileSize: 100_000_000,
  mimeType: "video/mp4",
});

// Handle chunk
await service.handleChunk({
  uploadId: session.uploadId,
  index: 0,
  size: 1048576,
  stream: chunkReadableStream,
});

// Get status
const status = await service.getStatus(session.uploadId);
console.log(status.missingChunks);

// Complete upload
const result = await service.completeUpload(session.uploadId);

// Or abort
await service.abortUpload(session.uploadId);
```

## API

### `TorrinService`

```typescript
class TorrinService {
  constructor(options: TorrinServiceOptions);

  initUpload(input: TorrinSessionInitInput): Promise<TorrinUploadSession>;
  handleChunk(input: HandleChunkInput): Promise<void>;
  getStatus(uploadId: string): Promise<TorrinUploadStatus>;
  completeUpload(
    uploadId: string,
    hash?: string
  ): Promise<TorrinCompleteResult>;
  abortUpload(uploadId: string): Promise<void>;

  // Cleanup
  cleanupExpiredUploads(): Promise<{ cleaned: number; errors: string[] }>;
  cleanupStaleUploads(
    maxAgeMs: number
  ): Promise<{ cleaned: number; errors: string[] }>;
}
```

### `TorrinServiceOptions`

```typescript
interface TorrinServiceOptions {
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number; // Default: 1MB
  maxChunkSize?: number; // Default: 100MB
  uploadTtlMs?: number; // Default: 24 hours
}
```

### Storage Driver Interface

Implement this to create custom storage backends:

```typescript
interface TorrinStorageDriver {
  initUpload(session: TorrinUploadSession): Promise<void>;

  writeChunk(
    session: TorrinUploadSession,
    chunkIndex: number,
    stream: Readable,
    expectedSize: number,
    hash?: string
  ): Promise<void>;

  finalizeUpload(session: TorrinUploadSession): Promise<TorrinStorageLocation>;

  abortUpload(session: TorrinUploadSession): Promise<void>;
}
```

### Upload Store Interface

Implement this for custom session persistence:

```typescript
interface TorrinUploadStore {
  createSession(
    init: TorrinSessionInitInput,
    chunkSize: number,
    ttlMs?: number
  ): Promise<TorrinUploadSession>;

  getSession(uploadId: string): Promise<TorrinUploadSession | null>;

  updateSession(
    uploadId: string,
    patch: Partial<TorrinUploadSession>
  ): Promise<TorrinUploadSession>;

  markChunkReceived(uploadId: string, chunkIndex: number): Promise<void>;
  listReceivedChunks(uploadId: string): Promise<number[]>;
  deleteSession(uploadId: string): Promise<void>;

  // Optional (for cleanup)
  listExpiredSessions?(): Promise<TorrinUploadSession[]>;
  listAllSessions?(): Promise<TorrinUploadSession[]>;
}
```

## Built-in Store

### In-memory store

```typescript
import { createInMemoryStore } from "@torrin/server";

const store = createInMemoryStore();
```

Features:

- TTL support with automatic expiration checks
- Tracks received chunks per upload
- Supports cleanup operations

**Note:** Data is lost on server restart. For production, implement a persistent store (Redis, PostgreSQL, etc.).

## Custom Store Example

### Redis store

```typescript
import { createClient } from "redis";
import type { TorrinUploadStore } from "@torrin/server";
import { generateUploadId, calculateTotalChunks } from "@torrin/core";

function createRedisStore(redisUrl: string): TorrinUploadStore {
  const client = createClient({ url: redisUrl });

  return {
    async createSession(init, chunkSize, ttlMs) {
      const uploadId = generateUploadId();
      const session = {
        uploadId,
        ...init,
        chunkSize,
        totalChunks: calculateTotalChunks(init.fileSize, chunkSize),
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: ttlMs ? new Date(Date.now() + ttlMs) : undefined,
      };

      await client.set(
        `upload:${uploadId}`,
        JSON.stringify(session),
        ttlMs ? { EX: Math.ceil(ttlMs / 1000) } : undefined
      );

      return session;
    },

    async getSession(uploadId) {
      const data = await client.get(`upload:${uploadId}`);
      return data ? JSON.parse(data) : null;
    },

    // ... implement other methods
  };
}
```

## TTL & Cleanup

### Configure TTL

```typescript
const service = new TorrinService({
  storage,
  store,
  uploadTtlMs: 24 * 60 * 60 * 1000, // 24 hours
});
```

### Cleanup expired uploads

```typescript
// Clean uploads past their TTL
const result = await service.cleanupExpiredUploads();
console.log(`Cleaned ${result.cleaned} uploads`);
console.log(`Errors: ${result.errors}`);
```

### Cleanup stale uploads

```typescript
// Clean uploads not updated in 12 hours
const result = await service.cleanupStaleUploads(12 * 60 * 60 * 1000);
```

### Periodic cleanup

```typescript
setInterval(async () => {
  const result = await service.cleanupExpiredUploads();
  if (result.cleaned > 0) {
    console.log(`Cleaned ${result.cleaned} expired uploads`);
  }
}, 60 * 60 * 1000); // Every hour
```

## Error Handling

All methods throw `TorrinError` on failure:

```typescript
import { TorrinError } from "@torrin/core";

try {
  await service.handleChunk({ ... });
} catch (error) {
  if (error instanceof TorrinError) {
    console.log(error.code);       // "CHUNK_SIZE_MISMATCH"
    console.log(error.statusCode); // 400
    console.log(error.message);
    console.log(error.details);
  }
}
```

## TypeScript

```typescript
import type {
  TorrinService,
  TorrinServiceOptions,
  TorrinStorageDriver,
  TorrinUploadStore,
  HandleChunkInput,
} from "@torrin/server";
```

## License

[Apache-2.0](LICENSE)
