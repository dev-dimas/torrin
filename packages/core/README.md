# @torrin/core

Shared types, error definitions, and utilities for Torrin upload engine.

## Installation

```bash
npm install @torrin/core
```

## Usage

This package is typically used as a dependency of other Torrin packages. You can also import types directly:

```typescript
import type {
  TorrinUploadSession,
  TorrinProgress,
  TorrinCompleteResult,
  TorrinStorageLocation,
  TorrinUploadState,
  UploadStatus,
} from "@torrin/core";

import {
  TorrinError,
  isUploadNotFound,
  isChunkError,
} from "@torrin/core";

import {
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  HTTP_HEADERS,
} from "@torrin/core";

import {
  generateUploadId,
  calculateTotalChunks,
  getMissingChunks,
  formatBytes,
} from "@torrin/core";
```

## Types

### TorrinUploadSession

```typescript
interface TorrinUploadSession {
  uploadId: string;
  fileName?: string;
  fileSize: number;
  mimeType?: string;
  chunkSize: number;
  totalChunks: number;
  metadata?: Record<string, unknown>;
  status: UploadStatus;
  createdAt: Date;
  updatedAt: Date;
}

type UploadStatus = "pending" | "in_progress" | "completed" | "failed" | "canceled";
```

### TorrinProgress

```typescript
interface TorrinProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  chunkIndex?: number;
  chunksCompleted: number;
  totalChunks: number;
}
```

### TorrinStorageLocation

```typescript
interface TorrinStorageLocation {
  type: "local" | "s3" | string;
  path?: string;
  bucket?: string;
  key?: string;
  url?: string;
  [key: string]: unknown;
}
```

## Error Handling

```typescript
import { TorrinError, isUploadNotFound } from "@torrin/core";

try {
  await someOperation();
} catch (error) {
  if (isUploadNotFound(error)) {
    // Handle 404
  }
  
  if (error instanceof TorrinError) {
    console.log(error.code);       // "UPLOAD_NOT_FOUND"
    console.log(error.statusCode); // 404
    console.log(error.toJSON());   // { error: { code, message, details } }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UPLOAD_NOT_FOUND` | 404 | Upload session not found |
| `UPLOAD_ALREADY_COMPLETED` | 409 | Upload already finalized |
| `UPLOAD_CANCELED` | 409 | Upload was canceled |
| `CHUNK_OUT_OF_RANGE` | 400 | Invalid chunk index |
| `CHUNK_SIZE_MISMATCH` | 400 | Chunk size doesn't match expected |
| `CHUNK_HASH_MISMATCH` | 400 | Chunk hash validation failed |
| `MISSING_CHUNKS` | 400 | Cannot complete, chunks missing |
| `STORAGE_ERROR` | 500 | Storage operation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `NETWORK_ERROR` | 503 | Network connectivity issue |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Utilities

```typescript
import {
  generateUploadId,
  calculateTotalChunks,
  normalizeChunkSize,
  getMissingChunks,
  getExpectedChunkSize,
  formatBytes,
  calculateProgress,
  hashBuffer,
} from "@torrin/core";

// Generate unique upload ID
const uploadId = generateUploadId(); // "u_m5k2j8a9b3c1"

// Calculate number of chunks
const chunks = calculateTotalChunks(10_000_000, 1_000_000); // 10

// Normalize chunk size within bounds
const size = normalizeChunkSize(500_000, 10_000_000); // 1048576 (min 256KB)

// Find missing chunks
const missing = getMissingChunks(10, [0, 1, 3, 5]); // [2, 4, 6, 7, 8, 9]

// Format bytes for display
const formatted = formatBytes(1536000); // "1.46 MB"

// Calculate percentage
const pct = calculateProgress(5_000_000, 10_000_000); // 50
```

## Constants

```typescript
import {
  DEFAULT_CHUNK_SIZE,    // 1MB
  MIN_CHUNK_SIZE,        // 256KB
  MAX_CHUNK_SIZE,        // 100MB
  DEFAULT_MAX_CONCURRENCY, // 3
  DEFAULT_RETRY_ATTEMPTS,  // 3
  DEFAULT_RETRY_DELAY,     // 1000ms
  HTTP_HEADERS,
} from "@torrin/core";

// HTTP header names
HTTP_HEADERS.CHUNK_HASH  // "x-torrin-chunk-hash"
HTTP_HEADERS.UPLOAD_ID   // "x-torrin-upload-id"
HTTP_HEADERS.CHUNK_INDEX // "x-torrin-chunk-index"
```

## License

Apache-2.0
