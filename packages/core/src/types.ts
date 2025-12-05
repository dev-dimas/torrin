export type UploadStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "canceled";

export interface TorrinUploadSession {
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

export interface TorrinSessionInitInput {
  fileName?: string;
  fileSize: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  desiredChunkSize?: number;
}

export interface TorrinChunk {
  index: number;
  size: number;
  hash?: string;
}

export interface TorrinUploadStatus {
  uploadId: string;
  status: UploadStatus;
  fileName?: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  missingChunks: number[];
}

export interface TorrinStorageLocation {
  type: "local" | "s3" | string;
  path?: string;
  bucket?: string;
  key?: string;
  url?: string;
  [key: string]: unknown;
}

export interface TorrinCompleteResult {
  uploadId: string;
  status: "completed";
  fileName?: string;
  fileSize: number;
  location: TorrinStorageLocation;
  metadata?: Record<string, unknown>;
}

export interface TorrinProgress {
  uploadId: string;
  bytesUploaded: number;
  totalBytes: number;
  percentage: number;
  chunkIndex?: number;
  chunksCompleted: number;
  totalChunks: number;
}

export interface TorrinUploadState {
  uploadId: string;
  fileName?: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  receivedChunks: number[];
  metadata?: Record<string, unknown>;
}
