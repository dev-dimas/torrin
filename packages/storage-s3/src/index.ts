import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type S3ClientConfig,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { TorrinError, type TorrinUploadSession, type TorrinStorageLocation } from "@torrin-kit/core";
import type { TorrinStorageDriver } from "@torrin-kit/server";

export interface S3StorageOptions {
  bucket: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  keyPrefix?: string;
  forcePathStyle?: boolean;
  s3ClientConfig?: S3ClientConfig;
  getObjectKey?: (session: TorrinUploadSession) => string;
}

interface MultipartState {
  uploadId: string;
  parts: CompletedPart[];
}

export function createS3StorageDriver(options: S3StorageOptions): TorrinStorageDriver {
  const {
    bucket,
    region,
    endpoint,
    credentials,
    keyPrefix = "uploads/",
    forcePathStyle,
    s3ClientConfig,
    getObjectKey,
  } = options;

  const client = new S3Client({
    region: region ?? "us-east-1",
    endpoint,
    credentials,
    forcePathStyle,
    ...s3ClientConfig,
  });

  const multipartUploads = new Map<string, MultipartState>();

  function buildObjectKey(session: TorrinUploadSession): string {
    if (getObjectKey) {
      return getObjectKey(session);
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const ext = session.fileName ? getExtension(session.fileName) : "";

    return `${keyPrefix}${year}/${month}/${session.uploadId}${ext}`;
  }

  function getExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf(".");
    return lastDot > 0 ? fileName.slice(lastDot) : "";
  }

  async function streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  return {
    async initUpload(session: TorrinUploadSession): Promise<void> {
      const key = buildObjectKey(session);

      try {
        const command = new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          ContentType: session.mimeType,
          Metadata: {
            "torrin-upload-id": session.uploadId,
            "torrin-file-name": session.fileName ?? "",
          },
        });

        const response = await client.send(command);

        if (!response.UploadId) {
          throw new Error("Failed to get S3 upload ID");
        }

        multipartUploads.set(session.uploadId, {
          uploadId: response.UploadId,
          parts: [],
        });
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to initiate S3 multipart upload for ${session.uploadId}`,
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
      const state = multipartUploads.get(session.uploadId);
      if (!state) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `No multipart upload found for ${session.uploadId}`
        );
      }

      const key = buildObjectKey(session);
      const partNumber = chunkIndex + 1; // S3 part numbers start at 1

      try {
        const body = await streamToBuffer(stream);

        if (body.length !== expectedSize) {
          throw new TorrinError(
            "CHUNK_SIZE_MISMATCH",
            `Chunk ${chunkIndex} size mismatch: expected ${expectedSize}, got ${body.length}`,
            { expected: expectedSize, actual: body.length }
          );
        }

        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: key,
          UploadId: state.uploadId,
          PartNumber: partNumber,
          Body: body,
          ContentLength: expectedSize,
        });

        const response = await client.send(command);

        state.parts[chunkIndex] = {
          ETag: response.ETag,
          PartNumber: partNumber,
        };
      } catch (error) {
        if (error instanceof TorrinError) throw error;
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to upload chunk ${chunkIndex} to S3 for ${session.uploadId}`,
          error
        );
      }
    },

    async finalizeUpload(session: TorrinUploadSession): Promise<TorrinStorageLocation> {
      const state = multipartUploads.get(session.uploadId);
      if (!state) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `No multipart upload found for ${session.uploadId}`
        );
      }

      const key = buildObjectKey(session);

      try {
        const sortedParts = state.parts
          .filter((p): p is CompletedPart => p !== undefined)
          .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0));

        const command = new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: state.uploadId,
          MultipartUpload: {
            Parts: sortedParts,
          },
        });

        const response = await client.send(command);

        multipartUploads.delete(session.uploadId);

        return {
          type: "s3",
          bucket,
          key,
          url: response.Location,
          etag: response.ETag,
        };
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to complete S3 multipart upload for ${session.uploadId}`,
          error
        );
      }
    },

    async abortUpload(session: TorrinUploadSession): Promise<void> {
      const state = multipartUploads.get(session.uploadId);
      if (!state) return;

      const key = buildObjectKey(session);

      try {
        const command = new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: state.uploadId,
        });

        await client.send(command);
        multipartUploads.delete(session.uploadId);
      } catch (error) {
        throw new TorrinError(
          "STORAGE_ERROR",
          `Failed to abort S3 multipart upload for ${session.uploadId}`,
          error
        );
      }
    },
  };
}
