export const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MB
export const MIN_CHUNK_SIZE = 256 * 1024; // 256 KB
export const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB

export const DEFAULT_MAX_CONCURRENCY = 3;
export const MAX_CONCURRENCY = 10;

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RETRY_DELAY = 1000; // 1 second

export const UPLOAD_ID_PREFIX = "u_";

export const HTTP_HEADERS = {
  CHUNK_HASH: "x-torrin-chunk-hash",
  UPLOAD_ID: "x-torrin-upload-id",
  CHUNK_INDEX: "x-torrin-chunk-index",
} as const;

export const ENDPOINTS = {
  INIT: "",
  CHUNK: "/:uploadId/chunks/:index",
  STATUS: "/:uploadId/status",
  COMPLETE: "/:uploadId/complete",
} as const;
