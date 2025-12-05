# @torrin/client

Client-side upload library for Torrin. Works in browsers and Node.js with resumable, chunked uploads.

**Size:** 15.9 KB (3.9 KB gzipped)

## Installation

```bash
npm install @torrin/client
```

## Quick Start

### Browser

```typescript
import { createTorrinClient } from "@torrin/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
});

const upload = torrin.createUpload({ file: myFile });
upload.on("progress", (p) => console.log(`${p.percentage}%`));

const result = await upload.start();
```

### Node.js

```typescript
import { readFileSync } from "fs";
import { createTorrinClient } from "@torrin/client";

const torrin = createTorrinClient({
  endpoint: "http://localhost:3000/torrin/uploads",
});

const upload = torrin.createUpload({
  buffer: readFileSync("./file.zip"),
  fileName: "file.zip",
});

const result = await upload.start();
```

## API

### `createTorrinClient(options)`

```typescript
interface TorrinClientOptions {
  endpoint: string; // Server endpoint URL
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  defaultChunkSize?: number; // Default: 1MB
  maxConcurrency?: number; // Default: 3
  resumeStore?: TorrinResumeStore; // For persistence
  retryAttempts?: number; // Default: 3
  retryDelay?: number; // Default: 1000ms
}
```

### `client.createUpload(options)`

```typescript
interface CreateUploadOptions {
  // Source (provide one)
  file?: File | Blob; // Browser
  buffer?: ArrayBuffer | Uint8Array; // Browser or Node

  // Metadata
  fileName?: string;
  fileSize?: number; // Required for buffer
  mimeType?: string;
  metadata?: Record<string, unknown>;
  chunkSize?: number; // Override default
}
```

### Upload instance

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

### Progress object

```typescript
interface TorrinProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number; // 0-100
  chunkIndex?: number;
  chunksCompleted: number;
  totalChunks: number;
}
```

## Features

### Progress tracking

```typescript
upload.on("progress", (p) => {
  progressBar.style.width = `${p.percentage}%`;
  console.log(`${p.chunksCompleted}/${p.totalChunks} chunks`);
  console.log(`${p.bytesUploaded}/${p.totalBytes} bytes`);
});

upload.on("status", (status) => {
  statusLabel.textContent = status;
});
```

### Pause, resume, cancel

```typescript
const upload = torrin.createUpload({ file });
upload.start();

// Pause upload
pauseBtn.onclick = () => upload.pause();

// Resume upload
resumeBtn.onclick = () => upload.resume();

// Cancel upload (allows re-upload of same file)
cancelBtn.onclick = () => upload.cancel();
```

### Resume after page refresh

```typescript
import {
  createTorrinClient,
  createLocalStorageResumeStore,
} from "@torrin/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
  resumeStore: createLocalStorageResumeStore(),
});

// If user selects the same file after refresh,
// upload automatically resumes from last chunk
const upload = torrin.createUpload({ file });
await upload.start(); // Resumes if previous upload exists
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

// Example: IndexedDB store
const store: TorrinResumeStore = {
  async save(uploadId, state) {
    await db.uploads.put({ id: uploadId, ...state });
  },
  async load(uploadId) {
    return db.uploads.get(uploadId);
  },
  // ... other methods
};
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

### Custom metadata

```typescript
const upload = torrin.createUpload({
  file,
  metadata: {
    userId: "user_123",
    projectId: "proj_456",
    tags: ["video", "tutorial"],
  },
});

const result = await upload.start();
console.log(result.metadata); // Same metadata returned
```

### Error handling

```typescript
import { TorrinError } from "@torrin/core";

upload.on("error", (error) => {
  if (error instanceof TorrinError) {
    switch (error.code) {
      case "NETWORK_ERROR":
        showRetryPrompt();
        break;
      case "UPLOAD_CANCELED":
        // User canceled
        break;
      default:
        showError(error.message);
    }
  }
});

try {
  await upload.start();
} catch (error) {
  // Same error is thrown and emitted
}
```

## Configuration

### Chunk size

```typescript
// Global default
const torrin = createTorrinClient({
  defaultChunkSize: 5 * 1024 * 1024, // 5MB
});

// Per-upload override
const upload = torrin.createUpload({
  file,
  chunkSize: 10 * 1024 * 1024, // 10MB
});
```

**Recommendations:**

- Small files (<10MB): 256KB - 1MB
- Medium files (10MB - 1GB): 1MB - 5MB
- Large files (>1GB): 5MB - 20MB

### Concurrency

```typescript
const torrin = createTorrinClient({
  maxConcurrency: 5, // Upload 5 chunks at once
});
```

### Retry

```typescript
const torrin = createTorrinClient({
  retryAttempts: 5, // Retry failed chunks 5 times
  retryDelay: 2000, // 2s initial delay (exponential backoff)
});
```

## Built-in Resume Stores

### localStorage (browser)

```typescript
import { createLocalStorageResumeStore } from "@torrin/client";

const torrin = createTorrinClient({
  resumeStore: createLocalStorageResumeStore(),
});
```

### In-memory (testing)

```typescript
import { createInMemoryResumeStore } from "@torrin/client";

const torrin = createTorrinClient({
  resumeStore: createInMemoryResumeStore(),
});
```

## TypeScript

```typescript
import type {
  TorrinClient,
  TorrinUpload,
  TorrinClientOptions,
  CreateUploadOptions,
  TorrinResumeStore,
  UploadClientStatus,
} from "@torrin/client";

import type { TorrinProgress, TorrinCompleteResult } from "@torrin/core";
```

## License

[Apache-2.0](LICENSE)
