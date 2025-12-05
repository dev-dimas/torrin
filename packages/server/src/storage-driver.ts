import type { TorrinUploadSession, TorrinStorageLocation } from "@torrin/core";
import type { Readable } from "node:stream";

export interface TorrinStorageDriver {
  initUpload(session: TorrinUploadSession): Promise<void>;

  writeChunk(
    session: TorrinUploadSession,
    chunkIndex: number,
    stream: Readable,
    expectedSize: number,
    hash?: string
  ): Promise<void>;

  finalizeUpload(session: TorrinUploadSession): Promise<TorrinStorageLocation>;

  abortUpload(session: TorrinUploadSession): Promise<void>;
}
