import {
  TorrinError,
  calculateProgress,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_MAX_CONCURRENCY,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAY,
  type TorrinProgress,
  type TorrinUploadState,
  type TorrinCompleteResult,
} from "@torrin-kit/core";
import type {
  TorrinUpload,
  TorrinResumeStore,
  UploadClientStatus,
} from "./types.js";
import { HttpClient } from "./http.js";
import { getChunkBlob, getFileKey } from "./chunker.js";

type EventHandler<T = unknown> = (data: T) => void;

interface UploadImplOptions {
  http: HttpClient;
  source: File | Blob | ArrayBuffer | Uint8Array;
  fileSize: number;
  fileName?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  desiredChunkSize?: number;
  maxConcurrency: number;
  resumeStore?: TorrinResumeStore;
  retryAttempts: number;
  retryDelay: number;
}

export function createUploadImpl(options: UploadImplOptions): TorrinUpload {
  const {
    http,
    source,
    fileSize,
    fileName,
    mimeType,
    metadata,
    desiredChunkSize,
    maxConcurrency,
    resumeStore,
    retryAttempts,
    retryDelay,
  } = options;

  let _uploadId: string | null = null;
  let _status: UploadClientStatus = "idle";
  let _chunkSize = desiredChunkSize ?? DEFAULT_CHUNK_SIZE;
  let _totalChunks = 0;
  let _receivedChunks = new Set<number>();
  let _bytesUploaded = 0;
  let _isPaused = false;
  let _isCanceled = false;
  let _pausePromise: { resolve: () => void } | null = null;

  const eventHandlers: Map<string, Set<EventHandler<any>>> = new Map();

  function emit<T>(event: string, data: T): void {
    const handlers = eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  function setStatus(status: UploadClientStatus): void {
    _status = status;
    emit("status", status);
  }

  function updateProgress(chunkIndex?: number): void {
    const progress: TorrinProgress = {
      uploadId: _uploadId ?? "",
      bytesUploaded: _bytesUploaded,
      totalBytes: fileSize,
      percentage: calculateProgress(_bytesUploaded, fileSize),
      chunkIndex,
      chunksCompleted: _receivedChunks.size,
      totalChunks: _totalChunks,
    };
    emit("progress", progress);
  }

  async function saveState(): Promise<void> {
    if (!resumeStore || !_uploadId) return;

    const fileKey = source instanceof Blob ? getFileKey(source, fileSize, fileName) : null;

    const state: TorrinUploadState = {
      uploadId: _uploadId,
      fileName,
      fileSize,
      chunkSize: _chunkSize,
      totalChunks: _totalChunks,
      receivedChunks: Array.from(_receivedChunks),
      metadata,
    };

    await resumeStore.save(_uploadId, state);
    
    if (fileKey && resumeStore.saveFileKey) {
      await resumeStore.saveFileKey(fileKey, _uploadId);
    }
  }

  async function tryResumeUpload(): Promise<boolean> {
    if (!resumeStore || !resumeStore.findByFile) return false;

    const fileKey = source instanceof Blob ? getFileKey(source, fileSize, fileName) : null;
    if (!fileKey) return false;

    const savedState = await resumeStore.findByFile(fileKey);
    if (!savedState) return false;

    try {
      const status = await http.getStatus(savedState.uploadId);

      if (status.status === "completed" || status.status === "canceled") {
        await resumeStore.remove(savedState.uploadId);
        return false;
      }

      _uploadId = savedState.uploadId;
      _chunkSize = status.chunkSize;
      _totalChunks = status.totalChunks;
      _receivedChunks = new Set(status.receivedChunks);
      _bytesUploaded = calculateBytesUploaded(status.receivedChunks, _chunkSize, fileSize);

      console.log(`[Torrin] Resuming upload ${_uploadId}: ${_receivedChunks.size}/${_totalChunks} chunks already uploaded`);
      return true;
    } catch {
      await resumeStore.remove(savedState.uploadId);
      return false;
    }
  }

  function calculateBytesUploaded(
    receivedChunks: number[],
    chunkSize: number,
    totalSize: number
  ): number {
    let bytes = 0;
    const lastChunkIndex = Math.ceil(totalSize / chunkSize) - 1;

    for (const index of receivedChunks) {
      if (index === lastChunkIndex) {
        bytes += totalSize % chunkSize || chunkSize;
      } else {
        bytes += chunkSize;
      }
    }

    return bytes;
  }

  function getChunkInfo(index: number): { index: number; start: number; end: number; size: number } {
    const start = index * _chunkSize;
    const end = Math.min(start + _chunkSize, fileSize);
    return { index, start, end, size: end - start };
  }

  async function waitIfPaused(): Promise<void> {
    if (!_isPaused) return;
    
    await new Promise<void>((resolve) => {
      _pausePromise = { resolve };
    });
    _pausePromise = null;
  }

  async function uploadChunkWithRetry(chunkIndex: number, attempt = 1): Promise<void> {
    if (_isCanceled) throw new TorrinError("UPLOAD_CANCELED", "Upload was canceled");
    
    await waitIfPaused();
    
    if (_isCanceled) throw new TorrinError("UPLOAD_CANCELED", "Upload was canceled");

    const chunkInfo = getChunkInfo(chunkIndex);

    try {
      const chunkBlob = await getChunkBlob(source, chunkInfo);
      await http.uploadChunk(_uploadId!, chunkInfo.index, chunkBlob);

      _receivedChunks.add(chunkInfo.index);
      _bytesUploaded += chunkInfo.size;
      updateProgress(chunkInfo.index);
      
      // Save state periodically (every 10 chunks) to avoid too many writes
      if (_receivedChunks.size % 10 === 0 || _receivedChunks.size === _totalChunks) {
        await saveState();
      }
    } catch (error) {
      if (_isCanceled) throw new TorrinError("UPLOAD_CANCELED", "Upload was canceled");

      if (attempt < retryAttempts) {
        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        return uploadChunkWithRetry(chunkIndex, attempt + 1);
      }

      throw error;
    }
  }

  async function uploadChunks(): Promise<void> {
    // Build list of chunks that need to be uploaded
    const pendingChunks: number[] = [];
    for (let i = 0; i < _totalChunks; i++) {
      if (!_receivedChunks.has(i)) {
        pendingChunks.push(i);
      }
    }

    if (pendingChunks.length === 0) return;

    let currentIndex = 0;
    const activeUploads = new Map<number, Promise<void>>();
    let uploadError: Error | null = null;

    while (currentIndex < pendingChunks.length || activeUploads.size > 0) {
      if (_isCanceled) {
        throw new TorrinError("UPLOAD_CANCELED", "Upload was canceled");
      }

      // Start new uploads up to concurrency limit
      while (
        activeUploads.size < maxConcurrency &&
        currentIndex < pendingChunks.length &&
        !uploadError &&
        !_isCanceled
      ) {
        const chunkIndex = pendingChunks[currentIndex]!;
        currentIndex++;

        const uploadPromise = uploadChunkWithRetry(chunkIndex)
          .catch((err) => {
            if (!uploadError) uploadError = err;
          })
          .finally(() => {
            activeUploads.delete(chunkIndex);
          });

        activeUploads.set(chunkIndex, uploadPromise);
      }

      // Wait for at least one upload to complete
      if (activeUploads.size > 0) {
        await Promise.race(activeUploads.values());
      }

      // Check for errors
      if (uploadError) {
        // Wait for all active uploads to finish before throwing
        await Promise.allSettled(activeUploads.values());
        throw uploadError;
      }
    }
  }

  const upload: TorrinUpload = {
    get uploadId() {
      return _uploadId;
    },

    get status() {
      return _status;
    },

    async start(): Promise<TorrinCompleteResult> {
      if (_status !== "idle") {
        throw new TorrinError("INVALID_REQUEST", "Upload already started");
      }

      try {
        setStatus("initializing");

        const resumed = await tryResumeUpload();

        if (!resumed) {
          const response = await http.initUpload({
            fileName,
            fileSize,
            mimeType,
            metadata,
            desiredChunkSize,
          });

          _uploadId = response.uploadId;
          _chunkSize = response.chunkSize;
          _totalChunks = response.totalChunks;
          
          // Save initial state for resume
          await saveState();
        }

        setStatus("uploading");
        updateProgress();

        await uploadChunks();

        // Final save before completing
        await saveState();

        setStatus("completing");
        const result = (await http.complete(_uploadId!)) as TorrinCompleteResult;

        if (resumeStore && _uploadId) {
          await resumeStore.remove(_uploadId);
        }

        setStatus("completed");
        return result;
      } catch (error) {
        if (_isCanceled) {
          setStatus("canceled");
        } else {
          setStatus("failed");
          emit("error", error);
        }
        throw error;
      }
    },

    pause(): void {
      if (_status === "uploading") {
        _isPaused = true;
        setStatus("paused");
      }
    },

    resume(): void {
      if (_status === "paused") {
        _isPaused = false;
        setStatus("uploading");
        _pausePromise?.resolve();
      }
    },

    async cancel(): Promise<void> {
      _isCanceled = true;
      _pausePromise?.resolve();

      // Remove file key mapping so same file can be uploaded again
      const fileKey = source instanceof Blob ? getFileKey(source, fileSize, fileName) : null;
      if (fileKey && resumeStore?.removeFileKey) {
        try {
          await resumeStore.removeFileKey(fileKey);
        } catch {
          // ignore
        }
      }

      if (_uploadId) {
        try {
          await http.abort(_uploadId);
        } catch {
          // ignore abort errors
        }

        if (resumeStore) {
          await resumeStore.remove(_uploadId);
        }
      }

      setStatus("canceled");
    },

    on(event: string, handler: EventHandler<any>): TorrinUpload {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, new Set());
      }
      eventHandlers.get(event)!.add(handler);
      return upload;
    },

    off(event: string, handler: EventHandler<any>): TorrinUpload {
      eventHandlers.get(event)?.delete(handler);
      return upload;
    },
  };

  return upload;
}
