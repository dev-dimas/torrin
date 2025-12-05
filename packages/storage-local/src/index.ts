import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, readdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { TorrinError, type TorrinUploadSession, type TorrinStorageLocation } from "@torrin-kit/core";
import type { TorrinStorageDriver } from "@torrin-kit/server";

export interface LocalStorageOptions {
  baseDir: string;
  tempDir?: string;
  preserveFileName?: boolean;
}

export function createLocalStorageDriver(options: LocalStorageOptions): TorrinStorageDriver {
  const baseDir = options.baseDir;
  const tempDir = options.tempDir ?? join(baseDir, ".temp");
  const preserveFileName = options.preserveFileName ?? false;

  function getUploadTempDir(uploadId: string): string {
    return join(tempDir, uploadId);
  }

  function getChunkPath(uploadId: string, chunkIndex: number): string {
    return join(getUploadTempDir(uploadId), `chunk_${chunkIndex.toString().padStart(6, "0")}`);
  }

  function getFinalPath(session: TorrinUploadSession): string {
    if (preserveFileName && session.fileName) {
      return join(baseDir, session.uploadId, session.fileName);
    }
    const ext = session.fileName ? getExtension(session.fileName) : "";
    return join(baseDir, `${session.uploadId}${ext}`);
  }

  function getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.slice(lastDot) : "";
  }

  return {
    async initUpload(session: TorrinUploadSession): Promise<void> {
      const uploadDir = getUploadTempDir(session.uploadId);
      try {
        await mkdir(uploadDir, { recursive: true });
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to create temp directory for upload ${session.uploadId}`,
          error
        );
      }
    },

    async writeChunk(
      session: TorrinUploadSession,
      chunkIndex: number,
      stream: Readable,
      expectedSize: number,
      _hash?: string
    ): Promise<void> {
      const chunkPath = getChunkPath(session.uploadId, chunkIndex);

      try {
        const writeStream = createWriteStream(chunkPath);
        await pipeline(stream, writeStream);

        const stats = await stat(chunkPath);
        if (stats.size !== expectedSize) {
          await rm(chunkPath, { force: true });
          throw new TorrinError(
            "CHUNK_SIZE_MISMATCH",
            `Chunk ${chunkIndex} size mismatch: expected ${expectedSize}, got ${stats.size}`,
            { expected: expectedSize, actual: stats.size }
          );
        }
      } catch (error) {
        if (error instanceof TorrinError) throw error;
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to write chunk ${chunkIndex} for upload ${session.uploadId}`,
          error
        );
      }
    },

    async finalizeUpload(session: TorrinUploadSession): Promise<TorrinStorageLocation> {
      const uploadTempDir = getUploadTempDir(session.uploadId);
      const finalPath = getFinalPath(session);

      try {
        const finalDir = join(finalPath, "..");
        await mkdir(finalDir, { recursive: true });

        const chunks = await readdir(uploadTempDir);
        chunks.sort();

        const writeStream = createWriteStream(finalPath);

        for (const chunkFile of chunks) {
          const chunkPath = join(uploadTempDir, chunkFile);
          const readStream = createReadStream(chunkPath);
          await pipeline(readStream, writeStream, { end: false });
        }

        writeStream.end();
        await new Promise<void>((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        await rm(uploadTempDir, { recursive: true, force: true });

        return {
          type: "local",
          path: finalPath,
        };
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to finalize upload ${session.uploadId}`,
          error
        );
      }
    },

    async abortUpload(session: TorrinUploadSession): Promise<void> {
      const uploadTempDir = getUploadTempDir(session.uploadId);
      try {
        await rm(uploadTempDir, { recursive: true, force: true });
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to abort upload ${session.uploadId}`,
          error
        );
      }
    },
  };
}
