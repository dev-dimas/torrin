import { Router, type Request, type Response, type NextFunction } from "express";
import { TorrinError, HTTP_HEADERS, type TorrinSessionInitInput } from "@torrin-kit/core";
import { TorrinService, type TorrinStorageDriver, type TorrinUploadStore } from "@torrin-kit/server";

export interface TorrinExpressOptions {
  basePath?: string;
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number;
  maxChunkSize?: number;
  uploadTtlMs?: number;
  onBeforeInit?: (req: Request, res: Response) => Promise<void> | void;
  onBeforeChunk?: (req: Request, res: Response) => Promise<void> | void;
  onBeforeComplete?: (req: Request, res: Response) => Promise<void> | void;
  onBeforeStatus?: (req: Request, res: Response) => Promise<void> | void;
}

export function createTorrinExpressRouter(options: TorrinExpressOptions): Router {
  const router = Router();
  const service = new TorrinService({
    storage: options.storage,
    store: options.store,
    defaultChunkSize: options.defaultChunkSize,
    maxChunkSize: options.maxChunkSize,
    uploadTtlMs: options.uploadTtlMs,
  });

  const handleError = (err: unknown, res: Response) => {
    if (err instanceof TorrinError) {
      res.status(err.statusCode).json(err.toJSON());
    } else {
      console.error("Torrin internal error:", err);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred",
        },
      });
    }
  };

  router.post("/", async (req: Request, res: Response) => {
    try {
      if (options.onBeforeInit) {
        await options.onBeforeInit(req, res);
        if (res.headersSent) return;
      }

      const input: TorrinSessionInitInput = {
        fileName: req.body.fileName,
        fileSize: req.body.fileSize,
        mimeType: req.body.mimeType,
        metadata: req.body.metadata,
        desiredChunkSize: req.body.desiredChunkSize,
      };

      const session = await service.initUpload(input);

      res.status(201).json({
        uploadId: session.uploadId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        metadata: session.metadata,
        status: session.status,
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.put("/:uploadId/chunks/:index", async (req: Request, res: Response) => {
    try {
      if (options.onBeforeChunk) {
        await options.onBeforeChunk(req, res);
        if (res.headersSent) return;
      }

      const uploadId = req.params.uploadId;
      const index = parseInt(req.params.index!, 10);
      const size = parseInt(req.headers["content-length"] ?? "0", 10);
      const hash = req.headers[HTTP_HEADERS.CHUNK_HASH] as string | undefined;

      if (isNaN(index)) {
        throw new TorrinError("INVALID_REQUEST", "Invalid chunk index");
      }

      if (size <= 0) {
        throw new TorrinError("INVALID_REQUEST", "Content-Length header is required");
      }

      await service.handleChunk({
        uploadId: uploadId!,
        index,
        size,
        hash,
        stream: req,
      });

      res.status(200).json({
        uploadId,
        receivedIndex: index,
        status: "in_progress",
      });
    } catch (err) {
      handleError(err, res);
    }
  });

  router.get("/:uploadId/status", async (req: Request, res: Response) => {
    try {
      if (options.onBeforeStatus) {
        await options.onBeforeStatus(req, res);
        if (res.headersSent) return;
      }

      const uploadId = req.params.uploadId!;
      const status = await service.getStatus(uploadId);

      res.status(200).json(status);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.post("/:uploadId/complete", async (req: Request, res: Response) => {
    try {
      if (options.onBeforeComplete) {
        await options.onBeforeComplete(req, res);
        if (res.headersSent) return;
      }

      const uploadId = req.params.uploadId!;
      const hash = req.body?.hash;

      const result = await service.completeUpload(uploadId, hash);

      res.status(200).json(result);
    } catch (err) {
      handleError(err, res);
    }
  });

  router.delete("/:uploadId", async (req: Request, res: Response) => {
    try {
      const uploadId = req.params.uploadId!;
      await service.abortUpload(uploadId);

      res.status(204).send();
    } catch (err) {
      handleError(err, res);
    }
  });

  return router;
}

export { TorrinService } from "@torrin-kit/server";
