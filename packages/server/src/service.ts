import type { Readable } from "node:stream";
import {
  TorrinError,
  normalizeChunkSize,
  getMissingChunks,
  getExpectedChunkSize,
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  type TorrinUploadSession,
  type TorrinSessionInitInput,
  type TorrinUploadStatus,
  type TorrinCompleteResult,
} from "@torrin-kit/core";
import type { TorrinStorageDriver } from "./storage-driver.js";
import type { TorrinUploadStore } from "./upload-store.js";

export interface TorrinServiceOptions {
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number;
  maxChunkSize?: number;
  uploadTtlMs?: number; // Time-to-live for uploads (default: 24 hours)
}

export interface HandleChunkInput {
  uploadId: string;
  index: number;
  size: number;
  hash?: string;
  stream: Readable;
}

const DEFAULT_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class TorrinService {
  private readonly storage: TorrinStorageDriver;
  private readonly store: TorrinUploadStore;
  private readonly defaultChunkSize: number;
  private readonly maxChunkSize: number;
  private readonly uploadTtlMs: number;

  constructor(options: TorrinServiceOptions) {
    this.storage = options.storage;
    this.store = options.store;
    this.defaultChunkSize = options.defaultChunkSize ?? DEFAULT_CHUNK_SIZE;
    this.maxChunkSize = options.maxChunkSize ?? MAX_CHUNK_SIZE;
    this.uploadTtlMs = options.uploadTtlMs ?? DEFAULT_UPLOAD_TTL_MS;
  }

  async initUpload(input: TorrinSessionInitInput): Promise<TorrinUploadSession> {
    if (input.fileSize <= 0) {
      throw new TorrinError("INVALID_REQUEST", "File size must be greater than 0");
    }

    const chunkSize = normalizeChunkSize(
      input.desiredChunkSize ?? this.defaultChunkSize,
      input.fileSize
    );

    const session = await this.store.createSession(input, chunkSize, this.uploadTtlMs);

    await this.storage.initUpload(session);

    return session;
  }

  async handleChunk(input: HandleChunkInput): Promise<void> {
    const session = await this.getSessionOrThrow(input.uploadId);

    this.validateSessionForChunk(session);
    this.validateChunkIndex(input.index, session.totalChunks);

    const expectedSize = getExpectedChunkSize(
      input.index,
      session.totalChunks,
      session.fileSize,
      session.chunkSize
    );

    if (input.size !== expectedSize) {
      throw new TorrinError(
        "CHUNK_SIZE_MISMATCH",
        `Expected chunk size ${expectedSize}, got ${input.size}`,
        { expected: expectedSize, actual: input.size }
      );
    }

    await this.storage.writeChunk(
      session,
      input.index,
      input.stream,
      expectedSize,
      input.hash
    );

    await this.store.markChunkReceived(input.uploadId, input.index);

    if (session.status === "pending") {
      await this.store.updateSession(input.uploadId, { status: "in_progress" });
    }
  }

  async getStatus(uploadId: string): Promise<TorrinUploadStatus> {
    const session = await this.getSessionOrThrow(uploadId);
    const receivedChunks = await this.store.listReceivedChunks(uploadId);
    const missingChunks = getMissingChunks(session.totalChunks, receivedChunks);

    return {
      uploadId: session.uploadId,
      status: session.status,
      fileName: session.fileName,
      fileSize: session.fileSize,
      chunkSize: session.chunkSize,
      totalChunks: session.totalChunks,
      receivedChunks,
      missingChunks,
    };
  }

  async completeUpload(uploadId: string, hash?: string): Promise<TorrinCompleteResult> {
    const session = await this.getSessionOrThrow(uploadId);

    if (session.status === "completed") {
      throw new TorrinError(
        "UPLOAD_ALREADY_COMPLETED",
        `Upload ${uploadId} is already completed`
      );
    }

    if (session.status === "canceled") {
      throw new TorrinError("UPLOAD_CANCELED", `Upload ${uploadId} was canceled`);
    }

    const receivedChunks = await this.store.listReceivedChunks(uploadId);
    const missingChunks = getMissingChunks(session.totalChunks, receivedChunks);

    if (missingChunks.length > 0) {
      throw new TorrinError(
        "MISSING_CHUNKS",
        `Upload ${uploadId} is missing ${missingChunks.length} chunks`,
        { missingChunks }
      );
    }

    const location = await this.storage.finalizeUpload(session);

    await this.store.updateSession(uploadId, { status: "completed" });

    return {
      uploadId: session.uploadId,
      status: "completed",
      fileName: session.fileName,
      fileSize: session.fileSize,
      location,
      metadata: session.metadata,
    };
  }

  async abortUpload(uploadId: string): Promise<void> {
    const session = await this.getSessionOrThrow(uploadId);

    if (session.status === "completed") {
      throw new TorrinError(
        "UPLOAD_ALREADY_COMPLETED",
        `Cannot abort completed upload ${uploadId}`
      );
    }

    await this.storage.abortUpload(session);
    await this.store.updateSession(uploadId, { status: "canceled" });
  }

  async cleanupExpiredUploads(): Promise<{ cleaned: number; errors: string[] }> {
    if (!this.store.listExpiredSessions) {
      return { cleaned: 0, errors: ["Store does not support listing expired sessions"] };
    }

    const expired = await this.store.listExpiredSessions();
    let cleaned = 0;
    const errors: string[] = [];

    for (const session of expired) {
      try {
        // Only cleanup non-completed uploads
        if (session.status !== "completed") {
          await this.storage.abortUpload(session);
        }
        await this.store.deleteSession(session.uploadId);
        cleaned++;
      } catch (error) {
        errors.push(`Failed to cleanup ${session.uploadId}: ${error}`);
      }
    }

    return { cleaned, errors };
  }

  async cleanupStaleUploads(maxAgeMs: number): Promise<{ cleaned: number; errors: string[] }> {
    if (!this.store.listAllSessions) {
      return { cleaned: 0, errors: ["Store does not support listing all sessions"] };
    }

    const allSessions = await this.store.listAllSessions();
    const now = Date.now();
    let cleaned = 0;
    const errors: string[] = [];

    for (const session of allSessions) {
      const age = now - session.updatedAt.getTime();
      const isStale = age > maxAgeMs && session.status !== "completed";

      if (isStale) {
        try {
          await this.storage.abortUpload(session);
          await this.store.deleteSession(session.uploadId);
          cleaned++;
        } catch (error) {
          errors.push(`Failed to cleanup ${session.uploadId}: ${error}`);
        }
      }
    }

    return { cleaned, errors };
  }

  private async getSessionOrThrow(uploadId: string): Promise<TorrinUploadSession> {
    const session = await this.store.getSession(uploadId);
    if (!session) {
      throw new TorrinError("UPLOAD_NOT_FOUND", `Upload ${uploadId} not found`);
    }
    return session;
  }

  private validateSessionForChunk(session: TorrinUploadSession): void {
    if (session.status === "completed") {
      throw new TorrinError(
        "UPLOAD_ALREADY_COMPLETED",
        `Upload ${session.uploadId} is already completed`
      );
    }

    if (session.status === "canceled") {
      throw new TorrinError(
        "UPLOAD_CANCELED",
        `Upload ${session.uploadId} was canceled`
      );
    }
  }

  private validateChunkIndex(index: number, totalChunks: number): void {
    if (index < 0 || index >= totalChunks) {
      throw new TorrinError(
        "CHUNK_OUT_OF_RANGE",
        `Chunk index ${index} is out of range [0, ${totalChunks - 1}]`,
        { index, totalChunks }
      );
    }
  }
}
