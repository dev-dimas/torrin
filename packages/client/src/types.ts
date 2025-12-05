import type { TorrinProgress, TorrinUploadState, TorrinCompleteResult } from "@torrin/core";

export interface TorrinClientOptions {
  endpoint: string;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  defaultChunkSize?: number;
  maxConcurrency?: number;
  resumeStore?: TorrinResumeStore;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface TorrinResumeStore {
  save(uploadId: string, state: TorrinUploadState): Promise<void> | void;
  load(uploadId: string): Promise<TorrinUploadState | null> | TorrinUploadState | null;
  remove(uploadId: string): Promise<void> | void;
  findByFile?(fileKey: string): Promise<TorrinUploadState | null> | TorrinUploadState | null;
  saveFileKey?(fileKey: string, uploadId: string): Promise<void> | void;
  removeFileKey?(fileKey: string): Promise<void> | void;
}

export interface CreateUploadOptions {
  file?: File | Blob;
  buffer?: ArrayBuffer | Uint8Array;
  stream?: ReadableStream<Uint8Array>;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  chunkSize?: number;
  onProgress?: (progress: TorrinProgress) => void;
}

export interface TorrinUpload {
  start(): Promise<TorrinCompleteResult>;
  pause(): void;
  resume(): void;
  cancel(): Promise<void>;
  on(event: "progress", handler: (p: TorrinProgress) => void): this;
  on(event: "error", handler: (err: Error) => void): this;
  on(event: "status", handler: (status: string) => void): this;
  off(event: string, handler: (...args: unknown[]) => void): this;
  readonly uploadId: string | null;
  readonly status: UploadClientStatus;
}

export type UploadClientStatus =
  | "idle"
  | "initializing"
  | "uploading"
  | "paused"
  | "completing"
  | "completed"
  | "failed"
  | "canceled";

export interface InitUploadResponse {
  uploadId: string;
  fileName?: string;
  fileSize: number;
  mimeType?: string;
  chunkSize: number;
  totalChunks: number;
  metadata?: Record<string, unknown>;
  status: string;
}

export interface ChunkUploadResponse {
  uploadId: string;
  receivedIndex: number;
  status: string;
}

export interface StatusResponse {
  uploadId: string;
  status: string;
  fileName?: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  missingChunks: number[];
}
