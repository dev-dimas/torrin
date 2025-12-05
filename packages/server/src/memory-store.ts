import {
  generateUploadId,
  calculateTotalChunks,
  TorrinError,
  type TorrinUploadSession,
  type TorrinSessionInitInput,
} from "@torrin/core";
import type { TorrinUploadStore } from "./upload-store.js";

interface StoredSession {
  session: TorrinUploadSession;
  receivedChunks: Set<number>;
}

export function createInMemoryStore(): TorrinUploadStore {
  const sessions = new Map<string, StoredSession>();

  return {
    async createSession(
      init: TorrinSessionInitInput,
      chunkSize: number,
      ttlMs?: number
    ): Promise<TorrinUploadSession> {
      const uploadId = generateUploadId();
      const totalChunks = calculateTotalChunks(init.fileSize, chunkSize);
      const now = new Date();

      const session: TorrinUploadSession = {
        uploadId,
        fileName: init.fileName,
        fileSize: init.fileSize,
        mimeType: init.mimeType,
        chunkSize,
        totalChunks,
        metadata: init.metadata,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        expiresAt: ttlMs ? new Date(now.getTime() + ttlMs) : undefined,
      };

      sessions.set(uploadId, {
        session,
        receivedChunks: new Set(),
      });

      return session;
    },

    async getSession(uploadId: string): Promise<TorrinUploadSession | null> {
      const stored = sessions.get(uploadId);
      if (!stored) return null;

      // Check if expired
      if (stored.session.expiresAt && stored.session.expiresAt < new Date()) {
        return null;
      }

      return stored.session;
    },

    async updateSession(
      uploadId: string,
      patch: Partial<TorrinUploadSession>
    ): Promise<TorrinUploadSession> {
      const stored = sessions.get(uploadId);
      if (!stored) {
        throw new TorrinError("UPLOAD_NOT_FOUND", `Upload ${uploadId} not found`);
      }

      stored.session = {
        ...stored.session,
        ...patch,
        updatedAt: new Date(),
      };

      return stored.session;
    },

    async markChunkReceived(uploadId: string, chunkIndex: number): Promise<void> {
      const stored = sessions.get(uploadId);
      if (!stored) {
        throw new TorrinError("UPLOAD_NOT_FOUND", `Upload ${uploadId} not found`);
      }

      stored.receivedChunks.add(chunkIndex);
      stored.session.updatedAt = new Date();
    },

    async listReceivedChunks(uploadId: string): Promise<number[]> {
      const stored = sessions.get(uploadId);
      if (!stored) {
        throw new TorrinError("UPLOAD_NOT_FOUND", `Upload ${uploadId} not found`);
      }

      return Array.from(stored.receivedChunks).sort((a, b) => a - b);
    },

    async deleteSession(uploadId: string): Promise<void> {
      sessions.delete(uploadId);
    },

    async listExpiredSessions(): Promise<TorrinUploadSession[]> {
      const now = new Date();
      const expired: TorrinUploadSession[] = [];

      for (const stored of sessions.values()) {
        if (stored.session.expiresAt && stored.session.expiresAt < now) {
          expired.push(stored.session);
        }
      }

      return expired;
    },

    async listAllSessions(): Promise<TorrinUploadSession[]> {
      return Array.from(sessions.values()).map((s) => s.session);
    },
  };
}
