# @torrin/core

Shared types, error definitions, constants, and utilities for Torrin upload engine.

**Size:** 5.3 KB (1.9 KB gzipped)

## Installation

```bash
npm install @torrin/core
```

## Overview

This package provides the foundation for all Torrin packages:

- **Types** - TypeScript interfaces for uploads, sessions, progress, etc.
- **Errors** - Typed error classes with HTTP status code mapping
- **Constants** - Default values, limits, and HTTP header names
- **Utilities** - Helper functions for chunking, hashing, formatting

## Types

### Upload Session

```typescript
import type { TorrinUploadSession, UploadStatus } from "@torrin/core";

type UploadStatus = 
  | "pending" 
  | "in_progress" 
  | "completed" 
  | "failed" 
  | "canceled";

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
  expiresAt?: Date;
}
```

### Progress

```typescript
import type { TorrinProgress } from "@torrin/core";

interface TorrinProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;      // 0-100
  chunkIndex?: number;
  chunksCompleted: number;
  totalChunks: number;
}
```

### Storage Location

```typescript
import type { TorrinStorageLocation } from "@torrin/core";

interface TorrinStorageLocation {
  type: "local" | "s3" | string;
  path?: string;      // Local storage
  bucket?: string;    // S3
  key?: string;       // S3
  url?: string;       // Public URL
  [key: string]: unknown;
}
```

### Complete Result

```typescript
import type { TorrinCompleteResult } from "@torrin/core";

interface TorrinCompleteResult {
  uploadId: string;
  status: "completed";
  fileName?: string;
  fileSize: number;
  location: TorrinStorageLocation;
  metadata?: Record<string, unknown>;
}
```

## Errors

### TorrinError class

```typescript
import { TorrinError } from "@torrin/core";

const error = new TorrinError(
  "CHUNK_SIZE_MISMATCH",
  "Expected 1048576 bytes, got 1000000",
  { expected: 1048576, actual: 1000000 }
);

console.log(error.code);       // "CHUNK_SIZE_MISMATCH"
console.log(error.message);    // "Expected 1048576 bytes, got 1000000"
console.log(error.statusCode); // 400
console.log(error.details);    // { expected: 1048576, actual: 1000000 }
console.log(error.toJSON());   // { error: { code, message, details } }
```

### Error codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UPLOAD_NOT_FOUND` | 404 | Upload session not found |
| `UPLOAD_ALREADY_COMPLETED` | 409 | Upload already finalized |
| `UPLOAD_CANCELED` | 409 | Upload was canceled |
| `CHUNK_OUT_OF_RANGE` | 400 | Invalid chunk index |
| `CHUNK_SIZE_MISMATCH` | 400 | Chunk size doesn't match expected |
| `CHUNK_HASH_MISMATCH` | 400 | Chunk hash validation failed |
| `CHUNK_ALREADY_UPLOADED` | 409 | Chunk was already received |
| `MISSING_CHUNKS` | 400 | Cannot complete, chunks missing |
| `FILE_HASH_MISMATCH` | 400 | Final file hash doesn't match |
| `STORAGE_ERROR` | 500 | Storage operation failed |
| `INVALID_REQUEST` | 400 | Malformed request |
| `NETWORK_ERROR` | 503 | Network connectivity issue |
| `TIMEOUT_ERROR` | 503 | Operation timed out |
| `INTERNAL_ERROR` | 500 | Unexpected error |

### Type guards

```typescript
import { 
  isUploadNotFound, 
  isUploadAlreadyCompleted, 
  isChunkError 
} from "@torrin/core";

try {
  await someOperation();
} catch (error) {
  if (isUploadNotFound(error)) {
    // Handle 404
  } else if (isChunkError(error)) {
    // Handle chunk-related errors
  }
}
```

## Constants

```typescript
import {
  DEFAULT_CHUNK_SIZE,      // 1MB (1048576)
  MIN_CHUNK_SIZE,          // 256KB (262144)
  MAX_CHUNK_SIZE,          // 100MB (104857600)
  DEFAULT_MAX_CONCURRENCY, // 3
  MAX_CONCURRENCY,         // 10
  DEFAULT_RETRY_ATTEMPTS,  // 3
  DEFAULT_RETRY_DELAY,     // 1000ms
  UPLOAD_ID_PREFIX,        // "u_"
  HTTP_HEADERS,
} from "@torrin/core";

// HTTP header names
HTTP_HEADERS.CHUNK_HASH   // "x-torrin-chunk-hash"
HTTP_HEADERS.UPLOAD_ID    // "x-torrin-upload-id"
HTTP_HEADERS.CHUNK_INDEX  // "x-torrin-chunk-index"
```

## Utilities

### ID generation

```typescript
import { generateUploadId, isValidUploadId } from "@torrin/core";

const id = generateUploadId();  // "u_m5k2j8a9b3c1"
isValidUploadId(id);            // true
isValidUploadId("invalid");     // false
```

### Chunk calculations

```typescript
import { 
  calculateTotalChunks, 
  normalizeChunkSize,
  getExpectedChunkSize,
  getMissingChunks 
} from "@torrin/core";

// Calculate number of chunks
calculateTotalChunks(10_000_000, 1_000_000);  // 10

// Normalize chunk size within bounds
normalizeChunkSize(500_000, 10_000_000);  // 1048576 (min is 256KB)

// Get expected size for specific chunk (last chunk may be smaller)
getExpectedChunkSize(9, 10, 10_000_000, 1_000_000);  // 1000000 (last chunk)

// Find missing chunks
getMissingChunks(10, [0, 1, 3, 5]);  // [2, 4, 6, 7, 8, 9]
```

### Hashing

```typescript
import { hashBuffer, hashStream } from "@torrin/core";

// Hash ArrayBuffer (browser)
const hash = await hashBuffer(buffer, "SHA-256");

// Hash ReadableStream
const hash = await hashStream(stream, "SHA-256");
```

### Formatting

```typescript
import { formatBytes, calculateProgress } from "@torrin/core";

formatBytes(1536000);              // "1.46 MB"
formatBytes(0);                    // "0 B"
calculateProgress(5_000_000, 10_000_000);  // 50
```

## License

Apache-2.0
