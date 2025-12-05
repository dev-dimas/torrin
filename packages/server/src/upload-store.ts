import type { TorrinUploadSession, TorrinSessionInitInput } from "@torrin-kit/core";

export interface TorrinUploadStore {
  createSession(init: TorrinSessionInitInput, chunkSize: number, ttlMs?: number): Promise<TorrinUploadSession>;

  getSession(uploadId: string): Promise<TorrinUploadSession | null>;

  updateSession(
    uploadId: string,
    patch: Partial<TorrinUploadSession>
  ): Promise<TorrinUploadSession>;

  markChunkReceived(uploadId: string, chunkIndex: number): Promise<void>;

  listReceivedChunks(uploadId: string): Promise<number[]>;

  deleteSession(uploadId: string): Promise<void>;

  listExpiredSessions?(): Promise<TorrinUploadSession[]>;

  listAllSessions?(): Promise<TorrinUploadSession[]>;
}
