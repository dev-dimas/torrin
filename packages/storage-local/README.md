# @torrin-kit/storage-local

Local filesystem storage driver for Torrin upload engine.

**Size:** 3.8 KB minified (1.1 KB gzipped) · Runtime only

## Installation

```bash
npm install @torrin-kit/storage-local
```

## Usage

```typescript
import { createLocalStorageDriver } from "@torrin-kit/storage-local";

const storage = createLocalStorageDriver({
  baseDir: "./uploads",
});
```

## API

### `createLocalStorageDriver(options)`

```typescript
interface LocalStorageOptions {
  baseDir: string; // Final file destination
  tempDir?: string; // Chunk staging (default: baseDir/.temp)
  preserveFileName?: boolean; // Use original filename (default: false)
}
```

## Options

### `baseDir` (required)

Directory where final uploaded files are stored.

```typescript
const storage = createLocalStorageDriver({
  baseDir: "/data/uploads",
});
```

### `tempDir` (optional)

Directory for temporary chunk storage during upload. Defaults to `baseDir/.temp`.

```typescript
const storage = createLocalStorageDriver({
  baseDir: "/data/uploads",
  tempDir: "/tmp/torrin-chunks",
});
```

### `preserveFileName` (optional)

If `true`, files are stored in subdirectories with original filenames. If `false` (default), files use uploadId as filename.

**Default (`preserveFileName: false`):**

```
uploads/
├── u_abc123.mp4
├── u_def456.zip
└── u_ghi789.pdf
```

**With `preserveFileName: true`:**

```
uploads/
├── u_abc123/
│   └── video.mp4
├── u_def456/
│   └── archive.zip
└── u_ghi789/
│   └── document.pdf
```

## How It Works

### Upload flow

1. **initUpload**: Creates temp directory for chunks
2. **writeChunk**: Writes each chunk to temp directory as numbered files
3. **finalizeUpload**: Concatenates all chunks into final file, deletes temp directory
4. **abortUpload**: Deletes temp directory and all chunks

### Temporary storage

During upload, chunks are stored as:

```
uploads/
├── .temp/
│   └── u_abc123/
│       ├── chunk_000000
│       ├── chunk_000001
│       └── chunk_000002
```

### Storage location

After completion, returns:

```typescript
{
  type: "local",
  path: "/data/uploads/u_abc123.mp4"
}
```

## Example

```typescript
import express from "express";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createLocalStorageDriver } from "@torrin-kit/storage-local";
import { createInMemoryStore } from "@torrin-kit/server";

const app = express();
app.use(express.json());

const storage = createLocalStorageDriver({
  baseDir: "./uploads",
  tempDir: "./uploads/.chunks",
  preserveFileName: true,
});

app.use(
  "/torrin/uploads",
  createTorrinExpressRouter({
    storage,
    store: createInMemoryStore(),
  })
);

// Serve uploaded files
app.use("/files", express.static("./uploads"));

app.listen(3000);
```

## Cleanup

### Orphaned chunks

Orphaned chunks from interrupted uploads can be cleaned:

```bash
# Remove temp directories older than 24 hours
find /data/uploads/.temp -type d -mtime +1 -exec rm -rf {} +
```

### Programmatic cleanup

```typescript
import { rm, readdir, stat } from "fs/promises";
import { join } from "path";

async function cleanupOrphanedChunks(tempDir: string, maxAgeMs: number) {
  const entries = await readdir(tempDir);
  const now = Date.now();

  for (const entry of entries) {
    const path = join(tempDir, entry);
    const stats = await stat(path);

    if (now - stats.mtimeMs > maxAgeMs) {
      await rm(path, { recursive: true });
      console.log(`Cleaned orphaned upload: ${entry}`);
    }
  }
}

// Clean uploads older than 24 hours
await cleanupOrphanedChunks("./uploads/.temp", 24 * 60 * 60 * 1000);
```

## TypeScript

```typescript
import type { LocalStorageOptions } from "@torrin-kit/storage-local";
import type { TorrinStorageDriver } from "@torrin-kit/server";
```

## License

[Apache-2.0](LICENSE)
