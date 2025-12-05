# @torrin/server

Core server logic for Torrin upload engine. Framework-agnostic.

## Installation

```bash
npm install @torrin/server
```

## Usage

This package provides the core `TorrinService` and interfaces. For framework integrations, use:

- `@torrin/server-express` for Express.js
- `@torrin/server-nestjs` for NestJS

### Direct Usage

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
  metadata: { userId: "123" },
});

// Handle chunk upload
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
console.log(result.location);

// Or abort
await service.abortUpload(session.uploadId);
```

## API

### TorrinService

```typescript
class TorrinService {
  constructor(options: TorrinServiceOptions);
  
  initUpload(input: TorrinSessionInitInput): Promise<TorrinUploadSession>;
  
  handleChunk(input: HandleChunkInput): Promise<void>;
  
  getStatus(uploadId: string): Promise<TorrinUploadStatus>;
  
  completeUpload(uploadId: string, hash?: string): Promise<TorrinCompleteResult>;
  
  abortUpload(uploadId: string): Promise<void>;
}

interface TorrinServiceOptions {
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number;  // default: 1MB
  maxChunkSize?: number;      // default: 100MB
}
```

### Storage Driver Interface

Implement this to create custom storage backends:

```typescript
interface TorrinStorageDriver {
  // Called when upload session is created
  initUpload(session: TorrinUploadSession): Promise<void>;
  
  // Called for each chunk
  writeChunk(
    session: TorrinUploadSession,
    chunkIndex: number,
    stream: Readable,
    expectedSize: number,
    hash?: string
  ): Promise<void>;
  
  // Called when all chunks received
  finalizeUpload(session: TorrinUploadSession): Promise<TorrinStorageLocation>;
  
  // Called on cancel/abort
  abortUpload(session: TorrinUploadSession): Promise<void>;
}
```

### Upload Store Interface

Implement this for custom session persistence:

```typescript
interface TorrinUploadStore {
  createSession(
    init: TorrinSessionInitInput,
    chunkSize: number
  ): Promise<TorrinUploadSession>;
  
  getSession(uploadId: string): Promise<TorrinUploadSession | null>;
  
  updateSession(
    uploadId: string,
    patch: Partial<TorrinUploadSession>
  ): Promise<TorrinUploadSession>;
  
  markChunkReceived(uploadId: string, chunkIndex: number): Promise<void>;
  
  listReceivedChunks(uploadId: string): Promise<number[]>;
  
  deleteSession(uploadId: string): Promise<void>;
}
```

## Built-in Stores

### In-Memory Store

```typescript
import { createInMemoryStore } from "@torrin/server";

const store = createInMemoryStore();
```

Good for development and single-instance deployments. Data is lost on restart.

### Custom Store Example (Redis)

```typescript
import { createClient } from "redis";
import type { TorrinUploadStore } from "@torrin/server";

function createRedisStore(redisUrl: string): TorrinUploadStore {
  const client = createClient({ url: redisUrl });
  
  return {
    async createSession(init, chunkSize) {
      const uploadId = generateUploadId();
      const session = {
        uploadId,
        ...init,
        chunkSize,
        totalChunks: Math.ceil(init.fileSize / chunkSize),
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await client.set(`upload:${uploadId}`, JSON.stringify(session));
      await client.set(`chunks:${uploadId}`, JSON.stringify([]));
      
      return session;
    },
    
    async getSession(uploadId) {
      const data = await client.get(`upload:${uploadId}`);
      return data ? JSON.parse(data) : null;
    },
    
    async updateSession(uploadId, patch) {
      const session = await this.getSession(uploadId);
      if (!session) throw new Error("Not found");
      
      const updated = { ...session, ...patch, updatedAt: new Date() };
      await client.set(`upload:${uploadId}`, JSON.stringify(updated));
      return updated;
    },
    
    async markChunkReceived(uploadId, chunkIndex) {
      const chunks = JSON.parse(await client.get(`chunks:${uploadId}`) || "[]");
      if (!chunks.includes(chunkIndex)) {
        chunks.push(chunkIndex);
        await client.set(`chunks:${uploadId}`, JSON.stringify(chunks));
      }
    },
    
    async listReceivedChunks(uploadId) {
      const data = await client.get(`chunks:${uploadId}`);
      return data ? JSON.parse(data) : [];
    },
    
    async deleteSession(uploadId) {
      await client.del(`upload:${uploadId}`);
      await client.del(`chunks:${uploadId}`);
    },
  };
}
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
    console.log(error.message);    // "Expected chunk size 1048576, got 1000000"
  }
}
```

## License

Apache-2.0
