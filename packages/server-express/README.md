# @torrin-kit/server-express

Express.js integration for Torrin upload engine.

**Size:** 3.9 KB (1.1 KB gzipped)

## Installation

```bash
npm install @torrin-kit/server @torrin-kit/server-express @torrin-kit/storage-local
```

## Quick Start

```typescript
import express from "express";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore } from "@torrin-kit/server";

const app = express();
app.use(express.json());

const torrinRouter = createTorrinExpressRouter({
  storage: createLocalStorageDriver({ baseDir: "./uploads" }),
  store: createInMemoryStore(),
});

app.use("/torrin/uploads", torrinRouter);
app.listen(3000);
```

## API

### `createTorrinExpressRouter(options)`

```typescript
interface TorrinExpressOptions {
  // Required
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;

  // Optional
  defaultChunkSize?: number; // Default: 1MB
  maxChunkSize?: number; // Default: 100MB
  uploadTtlMs?: number; // Default: 24 hours

  // Lifecycle hooks
  onBeforeInit?(req: Request, res: Response): Promise<void> | void;
  onBeforeChunk?(req: Request, res: Response): Promise<void> | void;
  onBeforeComplete?(req: Request, res: Response): Promise<void> | void;
  onBeforeStatus?(req: Request, res: Response): Promise<void> | void;
}
```

## Endpoints

The router creates these endpoints:

| Method   | Path                       | Description       |
| -------- | -------------------------- | ----------------- |
| `POST`   | `/`                        | Initialize upload |
| `PUT`    | `/:uploadId/chunks/:index` | Upload chunk      |
| `GET`    | `/:uploadId/status`        | Get upload status |
| `POST`   | `/:uploadId/complete`      | Complete upload   |
| `DELETE` | `/:uploadId`               | Abort upload      |

## Lifecycle Hooks

### Authentication

```typescript
const router = createTorrinExpressRouter({
  storage,
  store,

  onBeforeInit: async (req, res) => {
    const user = await validateToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return; // Response sent, handler stops
    }
    (req as any).user = user;
  },

  onBeforeChunk: async (req, res) => {
    const user = await validateToken(req.headers.authorization);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
    }
  },
});
```

### Validation

```typescript
const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ALLOWED_TYPES = ["video/mp4", "image/jpeg", "image/png"];

const router = createTorrinExpressRouter({
  storage,
  store,

  onBeforeInit: (req, res) => {
    const { fileSize, mimeType } = req.body;

    if (fileSize > MAX_FILE_SIZE) {
      res.status(400).json({ error: "File too large" });
      return;
    }

    if (mimeType && !ALLOWED_TYPES.includes(mimeType)) {
      res.status(400).json({ error: "File type not allowed" });
      return;
    }
  },
});
```

### Rate limiting

```typescript
import rateLimit from "express-rate-limit";

const chunkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
});

app.use("/torrin/uploads/:uploadId/chunks", chunkLimiter);
```

### Logging

```typescript
const router = createTorrinExpressRouter({
  storage,
  store,

  onBeforeInit: (req) => {
    console.log(`New upload: ${req.body.fileName}`);
  },

  onBeforeChunk: (req) => {
    console.log(`Chunk ${req.params.index} for ${req.params.uploadId}`);
  },

  onBeforeComplete: (req) => {
    console.log(`Completing: ${req.params.uploadId}`);
  },
});
```

## Storage Drivers

### Local storage

```typescript
import { createLocalStorageDriver } from "@torrin-kit/storage-local";

const router = createTorrinExpressRouter({
  storage: createLocalStorageDriver({
    baseDir: "./uploads",
    tempDir: "./uploads/.temp",
  }),
  store: createInMemoryStore(),
});
```

### S3 storage

```typescript
import { createS3StorageDriver } from "@torrin-kit/storage-s3";

const router = createTorrinExpressRouter({
  storage: createS3StorageDriver({
    bucket: "my-bucket",
    region: "us-east-1",
  }),
  store: createInMemoryStore(),
});
```

## Cleanup

```typescript
import { TorrinService, createInMemoryStore } from "@torrin-kit/server";

const store = createInMemoryStore();
const storage = createLocalStorageDriver({ baseDir: "./uploads" });

// Create service for cleanup
const service = new TorrinService({ storage, store });

// Cleanup endpoint
app.post("/admin/cleanup", async (req, res) => {
  const result = await service.cleanupExpiredUploads();
  res.json(result);
});

// Periodic cleanup
setInterval(() => {
  service.cleanupExpiredUploads();
}, 60 * 60 * 1000);
```

## Full Example

```typescript
import express from "express";
import cors from "cors";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore, TorrinService } from "@torrin-kit/server";

const app = express();
app.use(cors());
app.use(express.json());

const storage = createLocalStorageDriver({ baseDir: "./uploads" });
const store = createInMemoryStore();
const service = new TorrinService({ storage, store });

const router = createTorrinExpressRouter({
  storage,
  store,
  uploadTtlMs: 60 * 60 * 1000, // 1 hour

  onBeforeInit: async (req, res) => {
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.API_KEY) {
      res.status(401).json({ error: "Invalid API key" });
    }
  },
});

app.use("/torrin/uploads", router);
app.use("/files", express.static("./uploads"));

app.post("/admin/cleanup", async (req, res) => {
  const result = await service.cleanupExpiredUploads();
  res.json(result);
});

app.listen(3000);
```

## TypeScript

```typescript
import type { Request, Response } from "express";
import type { TorrinExpressOptions } from "@torrin-kit/server-express";
```

## License

[Apache-2.0](LICENSE)
