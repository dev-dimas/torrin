import {
  TorrinError,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY,
} from "@torrin/core";
import type { TorrinClientOptions, CreateUploadOptions, TorrinUpload } from "./types.js";
import { HttpClient } from "./http.js";
import { createUploadImpl } from "./upload.js";

export interface TorrinClient {
  createUpload(options: CreateUploadOptions): TorrinUpload;
}

export function createTorrinClient(options: TorrinClientOptions): TorrinClient {
  const http = new HttpClient({
    endpoint: options.endpoint,
    headers: options.headers,
  });

  const defaultChunkSize = options.defaultChunkSize ?? DEFAULT_CHUNK_SIZE;
  const maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  const retryAttempts = options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS;
  const retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;

  return {
    createUpload(uploadOptions: CreateUploadOptions): TorrinUpload {
      const { file, buffer, stream, fileSize, fileName, mimeType, metadata, chunkSize } =
        uploadOptions;

      let source: File | Blob | ArrayBuffer | Uint8Array;
      let size: number;
      let name: string | undefined;
      let mime: string | undefined;

      if (file) {
        source = file;
        size = file.size;
        name = file instanceof File ? file.name : fileName;
        mime = file.type || mimeType;
      } else if (buffer) {
        source = buffer;
        size = buffer.byteLength;
        name = fileName;
        mime = mimeType;
      } else if (stream && fileSize !== undefined) {
        throw new TorrinError(
          "INVALID_REQUEST",
          "Stream uploads are not yet supported in the browser client. Use file or buffer instead."
        );
      } else {
        throw new TorrinError(
          "INVALID_REQUEST",
          "Must provide file, buffer, or stream with fileSize"
        );
      }

      if (size <= 0) {
        throw new TorrinError("INVALID_REQUEST", "File size must be greater than 0");
      }

      return createUploadImpl({
        http,
        source,
        fileSize: size,
        fileName: name,
        mimeType: mime,
        metadata,
        desiredChunkSize: chunkSize ?? defaultChunkSize,
        maxConcurrency,
        resumeStore: options.resumeStore,
        retryAttempts,
        retryDelay,
      });
    },
  };
}
