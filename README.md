# ![Torrin Logo](https://i.imgur.com/cxTNLMH.png)

# Torrin

A modular, TypeScript-first upload engine for large files with resumable upload and chunk-level control.

## Features

- **Resumable Uploads** - Automatically resume interrupted uploads from where they left off
- **Chunked Transfer** - Split large files into manageable chunks for reliable uploads
- **Concurrent Uploads** - Upload multiple chunks in parallel for faster transfers
- **Cross-Platform** - Works in browsers (File/Blob) and Node.js (Buffer/Stream)
- **Storage Agnostic** - Local filesystem, S3-compatible storage, or custom drivers
- **Framework Integrations** - Express.js and NestJS out of the box
- **Type-Safe** - Full TypeScript support with strict types
- **Small Footprint** - Minimal dependencies, tree-shakeable ESM builds
- **TTL & Cleanup** - Automatic expiration and cleanup of abandoned uploads

## Packages

| Package                      | Description                     | Size (minified) | Size (gzipped) |
| ---------------------------- | ------------------------------- | --------------- | -------------- |
| `@torrin-kit/core`           | Shared types, errors, utilities | 5.1 KB          | 1.8 KB         |
| `@torrin-kit/client`         | Client-side upload library      | 15.5 KB         | 3.8 KB         |
| `@torrin-kit/server`         | Core server logic               | 8.7 KB          | 2.0 KB         |
| `@torrin-kit/server-express` | Express.js integration          | 3.7 KB          | 1.0 KB         |
| `@torrin-kit/server-nestjs`  | NestJS integration              | 6.8 KB          | 1.9 KB         |
| `@torrin-kit/storage-local`  | Local filesystem driver         | 3.8 KB          | 1.1 KB         |
| `@torrin-kit/storage-s3`     | S3-compatible driver            | 5.3 KB          | 1.4 KB         |

**Size notes:**

- **Size (min)** = Minified JavaScript code only (what gets executed)
- **Size (gzip)** = What you download (compressed for transfer)
- **npm unpacked** = Includes source maps & TypeScript declarations (larger, not downloaded by default)

**Total bundle size (client only):** ~5.6 KB gzipped (core + client)

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Server Setup](#server-setup)
  - [Express.js](#expressjs)
  - [NestJS](#nestjs)
- [Client Usage](#client-usage)
  - [Browser](#browser)
  - [Node.js](#nodejs)
- [API Reference](#api-reference)
  - [Client API](#client-api)
  - [Server API](#server-api)
  - [Storage Drivers](#storage-drivers)
- [Upload Protocol](#upload-protocol)
- [Resume & Persistence](#resume--persistence)
- [TTL & Cleanup](#ttl--cleanup)
- [Error Handling](#error-handling)
- [Configuration](#configuration)
- [TypeScript](#typescript)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

### 1. Install packages

```bash
# Server (Express)
npm install @torrin-kit/server @torrin-kit/server-express @torrin-kit/storage-local

# Client
npm install @torrin-kit/client
```

### 2. Setup server (Express)

```typescript
import express from "express";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore } from "@torrin-kit/server";

const app = express();
app.use(express.json());

app.use(
  "/torrin/uploads",
  createTorrinExpressRouter({
    storage: createLocalStorageDriver({ baseDir: "./uploads" }),
    store: createInMemoryStore(),
  })
);

app.listen(3000);
```

### 3. Upload from browser

```typescript
import { createTorrinClient } from "@torrin-kit/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
});

const upload = torrin.createUpload({ file: myFile });

upload.on("progress", (p) => console.log(`${p.percentage}%`));

const result = await upload.start();
console.log("Uploaded to:", result.location);
```

## Installation

### Server packages

```bash
# Core + Express
npm install @torrin-kit/server @torrin-kit/server-express

# Core + NestJS
npm install @torrin-kit/server @torrin-kit/server-nestjs

# Storage drivers (pick one or more)
npm install @torrin-kit/storage-local
npm install @torrin-kit/storage-s3 @aws-sdk/client-s3
```

### Client package

```bash
npm install @torrin-kit/client
```

## Server Setup

### Express.js

```typescript
import express from "express";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore } from "@torrin-kit/server";

const app = express();
app.use(express.json());

const torrinRouter = createTorrinExpressRouter({
  // Required
  storage: createLocalStorageDriver({ baseDir: "./uploads" }),
  store: createInMemoryStore(),

  // Optional
  defaultChunkSize: 1024 * 1024, // 1MB (default)
  maxChunkSize: 10 * 1024 * 1024, // 10MB max
  uploadTtlMs: 24 * 60 * 60 * 1000, // 24 hours (default)

  // Lifecycle hooks
  onBeforeInit: async (req, res) => {
    // Validate, authenticate, etc.
  },
  onBeforeChunk: async (req, res) => {
    // Rate limiting, logging, etc.
  },
  onBeforeComplete: async (req, res) => {
    // Virus scanning, etc.
  },
});

app.use("/torrin/uploads", torrinRouter);
app.listen(3000);
```

### NestJS

```typescript
import { Module } from "@nestjs/common";
import { TorrinModule } from "@torrin-kit/server-nestjs";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore } from "@torrin-kit/server";

@Module({
  imports: [
    TorrinModule.forRoot({
      storage: createLocalStorageDriver({ baseDir: "./uploads" }),
      store: createInMemoryStore(),
      uploadTtlMs: 24 * 60 * 60 * 1000,
    }),
  ],
})
export class AppModule {}
```

#### Async configuration

```typescript
TorrinModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    storage: createS3StorageDriver({
      bucket: config.get("S3_BUCKET"),
      region: config.get("AWS_REGION"),
    }),
    store: createInMemoryStore(),
  }),
});
```

#### Injecting TorrinService

```typescript
import { Injectable } from "@nestjs/common";
import { InjectTorrin, TorrinService } from "@torrin-kit/server-nestjs";

@Injectable()
export class UploadService {
  constructor(@InjectTorrin() private torrin: TorrinService) {}

  async getProgress(uploadId: string) {
    const status = await this.torrin.getStatus(uploadId);
    return status.receivedChunks.length / status.totalChunks;
  }
}
```

## Client Usage

### Browser

```typescript
import {
  createTorrinClient,
  createLocalStorageResumeStore,
} from "@torrin-kit/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
  resumeStore: createLocalStorageResumeStore(), // Enable resume
  maxConcurrency: 3,
});

// From file input
const fileInput = document.querySelector<HTMLInputElement>("#file");
fileInput.onchange = async () => {
  const file = fileInput.files[0];

  const upload = torrin.createUpload({
    file,
    metadata: { userId: "123" },
  });

  upload.on("progress", (p) => {
    progressBar.style.width = `${p.percentage}%`;
    console.log(`${p.chunksCompleted}/${p.totalChunks} chunks`);
  });

  upload.on("status", (status) => {
    console.log("Status:", status); // uploading, paused, completed, etc.
  });

  upload.on("error", (err) => {
    console.error("Upload failed:", err.message);
  });

  try {
    const result = await upload.start();
    console.log("Upload complete:", result.location);
  } catch (err) {
    // Error also emitted via "error" event
  }
};
```

### Node.js

```typescript
import { readFileSync } from "fs";
import { createTorrinClient } from "@torrin-kit/client";

const torrin = createTorrinClient({
  endpoint: "http://localhost:3000/torrin/uploads",
});

const buffer = readFileSync("./large-file.zip");

const upload = torrin.createUpload({
  buffer,
  fileName: "large-file.zip",
  mimeType: "application/zip",
});

upload.on("progress", (p) => {
  process.stdout.write(`\r${p.percentage}% uploaded`);
});

const result = await upload.start();
console.log("\nDone:", result.location);
```

### Pause, Resume, Cancel

```typescript
const upload = torrin.createUpload({ file });

// Start upload
upload.start();

// Pause
pauseBtn.onclick = () => upload.pause();

// Resume
resumeBtn.onclick = () => upload.resume();

// Cancel (removes file key, allowing re-upload of same file)
cancelBtn.onclick = () => upload.cancel();
```

## API Reference

### Client API

#### `createTorrinClient(options)`

```typescript
interface TorrinClientOptions {
  endpoint: string; // Server endpoint URL
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  defaultChunkSize?: number; // Default: 1MB
  maxConcurrency?: number; // Default: 3
  resumeStore?: TorrinResumeStore; // For persistence
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms (exponential backoff)
}
```

#### `client.createUpload(options)`

```typescript
interface CreateUploadOptions {
  // Source (provide one)
  file?: File | Blob; // Browser
  buffer?: ArrayBuffer | Uint8Array; // Browser or Node

  // Metadata
  fileName?: string;
  fileSize?: number; // Required for buffer
  mimeType?: string;
  metadata?: Record<string, unknown>; // Custom metadata
  chunkSize?: number; // Override default
}
```

#### Upload instance

```typescript
interface TorrinUpload {
  start(): Promise<TorrinCompleteResult>;
  pause(): void;
  resume(): void;
  cancel(): Promise<void>;

  on(event: "progress", handler: (p: TorrinProgress) => void): this;
  on(event: "error", handler: (err: Error) => void): this;
  on(event: "status", handler: (status: UploadClientStatus) => void): this;
  off(event: string, handler: Function): this;

  readonly uploadId: string | null;
  readonly status: UploadClientStatus;
}

type UploadClientStatus =
  | "idle"
  | "initializing"
  | "uploading"
  | "paused"
  | "completing"
  | "completed"
  | "failed"
  | "canceled";
```

#### Progress object

```typescript
interface TorrinProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number; // 0-100
  chunkIndex?: number; // Current chunk being uploaded
  chunksCompleted: number;
  totalChunks: number;
}
```

### Server API

#### `TorrinService`

```typescript
class TorrinService {
  constructor(options: TorrinServiceOptions);

  // Core operations
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

interface TorrinServiceOptions {
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number; // Default: 1MB
  maxChunkSize?: number; // Default: 100MB
  uploadTtlMs?: number; // Default: 24 hours
}
```

#### Storage driver interface

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

#### Upload store interface

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

### Storage Drivers

#### Local storage

```typescript
import { createLocalStorageDriver } from "@torrin-kit/storage-local";

const storage = createLocalStorageDriver({
  baseDir: "./uploads", // Final file destination
  tempDir: "./uploads/.temp", // Chunk staging (optional)
  preserveFileName: false, // Use uploadId as filename (default)
});
```

#### S3 storage

```typescript
import { createS3StorageDriver } from "@torrin-kit/storage-s3";

const storage = createS3StorageDriver({
  bucket: "my-bucket",
  region: "us-east-1",

  // Optional credentials (uses AWS SDK default chain if not provided)
  credentials: {
    accessKeyId: "...",
    secretAccessKey: "...",
  },

  // Optional: S3-compatible services (MinIO, R2, etc.)
  endpoint: "http://localhost:9000",
  forcePathStyle: true,

  // Optional: custom key generation
  keyPrefix: "uploads/",
  getObjectKey: (session) => `custom/${session.uploadId}/${session.fileName}`,
});
```

## Upload Protocol

Torrin uses a simple REST protocol:

### Initialize upload

```
POST /torrin/uploads
Content-Type: application/json

{
  "fileName": "video.mp4",
  "fileSize": 104857600,
  "mimeType": "video/mp4",
  "metadata": { "userId": "123" },
  "desiredChunkSize": 1048576
}
```

Response `201 Created`:

```json
{
  "uploadId": "u_abc123",
  "fileName": "video.mp4",
  "fileSize": 104857600,
  "chunkSize": 1048576,
  "totalChunks": 100,
  "status": "pending"
}
```

### Upload chunk

```
PUT /torrin/uploads/:uploadId/chunks/:index
Content-Type: application/octet-stream
Content-Length: 1048576
X-Torrin-Chunk-Hash: <optional-sha256>

<binary data>
```

Response `200 OK`:

```json
{
  "uploadId": "u_abc123",
  "receivedIndex": 0,
  "status": "in_progress"
}
```

### Get status

```
GET /torrin/uploads/:uploadId/status
```

Response `200 OK`:

```json
{
  "uploadId": "u_abc123",
  "status": "in_progress",
  "totalChunks": 100,
  "receivedChunks": [0, 1, 2, 5, 6],
  "missingChunks": [3, 4, 7, 8, ...]
}
```

### Complete upload

```
POST /torrin/uploads/:uploadId/complete
Content-Type: application/json

{ "hash": "<optional-file-hash>" }
```

Response `200 OK`:

```json
{
  "uploadId": "u_abc123",
  "status": "completed",
  "location": {
    "type": "local",
    "path": "/uploads/u_abc123.mp4"
  }
}
```

### Abort upload

```
DELETE /torrin/uploads/:uploadId
```

Response `204 No Content`

## Resume & Persistence

### Browser (localStorage)

```typescript
import {
  createTorrinClient,
  createLocalStorageResumeStore,
} from "@torrin-kit/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
  resumeStore: createLocalStorageResumeStore(),
});

// If user refreshes page and selects same file,
// upload automatically resumes from last chunk
```

### Custom resume store

```typescript
interface TorrinResumeStore {
  save(uploadId: string, state: TorrinUploadState): Promise<void> | void;
  load(
    uploadId: string
  ): Promise<TorrinUploadState | null> | TorrinUploadState | null;
  remove(uploadId: string): Promise<void> | void;
  findByFile?(
    fileKey: string
  ): Promise<TorrinUploadState | null> | TorrinUploadState | null;
  saveFileKey?(fileKey: string, uploadId: string): Promise<void> | void;
  removeFileKey?(fileKey: string): Promise<void> | void;
}
```

Example with IndexedDB:

```typescript
const indexedDBStore: TorrinResumeStore = {
  async save(uploadId, state) {
    await db.uploads.put({ id: uploadId, ...state });
  },
  async load(uploadId) {
    return db.uploads.get(uploadId);
  },
  async remove(uploadId) {
    await db.uploads.delete(uploadId);
  },
  async findByFile(fileKey) {
    return db.fileIndex.get(fileKey);
  },
  async saveFileKey(fileKey, uploadId) {
    await db.fileIndex.put({ fileKey, uploadId });
  },
  async removeFileKey(fileKey) {
    await db.fileIndex.delete(fileKey);
  },
};
```

## TTL & Cleanup

Uploads automatically expire after a configurable TTL (default: 24 hours).

### Server configuration

```typescript
const service = new TorrinService({
  storage,
  store,
  uploadTtlMs: 24 * 60 * 60 * 1000, // 24 hours
});
```

### Manual cleanup

```typescript
// Clean expired uploads (past TTL)
const result = await service.cleanupExpiredUploads();
console.log(`Cleaned ${result.cleaned} uploads`);

// Clean stale uploads (not updated in X time)
await service.cleanupStaleUploads(12 * 60 * 60 * 1000); // 12 hours
```

### Periodic cleanup

```typescript
// Run cleanup every hour
setInterval(async () => {
  const result = await service.cleanupExpiredUploads();
  if (result.cleaned > 0) {
    console.log(`Cleaned ${result.cleaned} expired uploads`);
  }
}, 60 * 60 * 1000);
```

### Cleanup endpoint (Express)

```typescript
app.post("/admin/cleanup", async (req, res) => {
  const result = await torrinService.cleanupExpiredUploads();
  res.json(result);
});
```

## Error Handling

### Error codes

| Code                       | HTTP | Description                       |
| -------------------------- | ---- | --------------------------------- |
| `UPLOAD_NOT_FOUND`         | 404  | Upload session not found          |
| `UPLOAD_ALREADY_COMPLETED` | 409  | Upload already finalized          |
| `UPLOAD_CANCELED`          | 409  | Upload was canceled               |
| `CHUNK_OUT_OF_RANGE`       | 400  | Invalid chunk index               |
| `CHUNK_SIZE_MISMATCH`      | 400  | Chunk size doesn't match expected |
| `CHUNK_HASH_MISMATCH`      | 400  | Chunk hash validation failed      |
| `MISSING_CHUNKS`           | 400  | Cannot complete, chunks missing   |
| `STORAGE_ERROR`            | 500  | Storage operation failed          |
| `INVALID_REQUEST`          | 400  | Malformed request                 |
| `NETWORK_ERROR`            | 503  | Network connectivity issue        |
| `INTERNAL_ERROR`           | 500  | Unexpected server error           |

### Client-side handling

```typescript
import { TorrinError } from "@torrin-kit/core";

upload.on("error", (error) => {
  if (error instanceof TorrinError) {
    switch (error.code) {
      case "NETWORK_ERROR":
        showRetryPrompt();
        break;
      case "UPLOAD_CANCELED":
        // Upload was canceled
        break;
      default:
        showError(error.message);
    }
  }
});
```

### Server-side handling

```typescript
import { TorrinError } from "@torrin-kit/core";

try {
  await service.completeUpload(uploadId);
} catch (error) {
  if (error instanceof TorrinError) {
    console.log(error.code); // "MISSING_CHUNKS"
    console.log(error.statusCode); // 400
    console.log(error.details); // { missingChunks: [3, 4, 7] }
  }
}
```

## Configuration

### Chunk size

```typescript
// Client default
const torrin = createTorrinClient({
  defaultChunkSize: 5 * 1024 * 1024, // 5MB
});

// Per-upload override
const upload = torrin.createUpload({
  file,
  chunkSize: 10 * 1024 * 1024, // 10MB
});

// Server limits
createTorrinExpressRouter({
  defaultChunkSize: 1024 * 1024, // 1MB default
  maxChunkSize: 100 * 1024 * 1024, // 100MB max
});
```

**Recommendations:**

- Small files (<10MB): 256KB - 1MB
- Medium files (10MB - 1GB): 1MB - 5MB
- Large files (>1GB): 5MB - 20MB

### Concurrency

```typescript
const torrin = createTorrinClient({
  maxConcurrency: 5, // Upload 5 chunks simultaneously
});
```

### Retry

```typescript
const torrin = createTorrinClient({
  retryAttempts: 5, // Retry failed chunks 5 times
  retryDelay: 2000, // 2s initial delay (exponential backoff)
});
```

### Authentication

```typescript
const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
  headers: async () => {
    const token = await getAccessToken();
    return { Authorization: `Bearer ${token}` };
  },
});
```

## TypeScript

All packages include TypeScript declarations:

```typescript
// Core types
import type {
  TorrinUploadSession,
  TorrinProgress,
  TorrinCompleteResult,
  TorrinStorageLocation,
  TorrinError,
  TorrinErrorCode,
  UploadStatus,
} from "@torrin-kit/core";

// Client types
import type {
  TorrinClient,
  TorrinUpload,
  TorrinClientOptions,
  CreateUploadOptions,
  TorrinResumeStore,
  UploadClientStatus,
} from "@torrin-kit/client";

// Server types
import type {
  TorrinService,
  TorrinServiceOptions,
  TorrinStorageDriver,
  TorrinUploadStore,
} from "@torrin-kit/server";
```

## Examples

See the `demos/` directory for working examples:

```bash
# Install dependencies
pnpm install
pnpm build

# Run Express backend
cd demos/demo-express && pnpm dev

# Run NestJS backend (alternative)
cd demos/demo-nestjs && pnpm dev

# Run React frontend
cd demos/demo-react && pnpm dev

# Open http://localhost:5173
```

### Demo features

- Drag & drop file upload
- Multiple file upload
- Real-time progress per chunk
- Pause/Resume/Cancel
- Auto-detect backend type
- Resumable uploads (localStorage)
- Automatic cleanup (TTL: 1 hour)

## Contributing

```bash
# Clone repository
git clone https://github.com/dev-dimas/torrin.git
cd torrin

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Run demos
cd demos/demo-express && pnpm dev
cd demos/demo-react && pnpm dev
```

## License

Apache-2.0 - see [LICENSE](LICENSE) for details.
