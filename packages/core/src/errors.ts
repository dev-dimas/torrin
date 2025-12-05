export type TorrinErrorCode =
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_ALREADY_COMPLETED"
  | "UPLOAD_CANCELED"
  | "CHUNK_OUT_OF_RANGE"
  | "CHUNK_SIZE_MISMATCH"
  | "CHUNK_HASH_MISMATCH"
  | "CHUNK_ALREADY_UPLOADED"
  | "MISSING_CHUNKS"
  | "FILE_HASH_MISMATCH"
  | "STORAGE_ERROR"
  | "INVALID_REQUEST"
  | "NETWORK_ERROR"
  | "TIMEOUT_ERROR"
  | "INTERNAL_ERROR";

export class TorrinError extends Error {
  readonly code: TorrinErrorCode;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor(code: TorrinErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "TorrinError";
    this.code = code;
    this.details = details;
    this.statusCode = errorCodeToStatusCode(code);
    Object.setPrototypeOf(this, TorrinError.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

function errorCodeToStatusCode(code: TorrinErrorCode): number {
  switch (code) {
    case "UPLOAD_NOT_FOUND":
      return 404;
    case "UPLOAD_ALREADY_COMPLETED":
    case "UPLOAD_CANCELED":
    case "CHUNK_ALREADY_UPLOADED":
      return 409;
    case "CHUNK_OUT_OF_RANGE":
    case "CHUNK_SIZE_MISMATCH":
    case "CHUNK_HASH_MISMATCH":
    case "MISSING_CHUNKS":
    case "FILE_HASH_MISMATCH":
    case "INVALID_REQUEST":
      return 400;
    case "STORAGE_ERROR":
    case "INTERNAL_ERROR":
      return 500;
    case "NETWORK_ERROR":
    case "TIMEOUT_ERROR":
      return 503;
    default:
      return 500;
  }
}

export function isUploadNotFound(error: unknown): error is TorrinError {
  return error instanceof TorrinError && error.code === "UPLOAD_NOT_FOUND";
}

export function isUploadAlreadyCompleted(error: unknown): error is TorrinError {
  return error instanceof TorrinError && error.code === "UPLOAD_ALREADY_COMPLETED";
}

export function isChunkError(error: unknown): error is TorrinError {
  return (
    error instanceof TorrinError &&
    (error.code === "CHUNK_OUT_OF_RANGE" ||
      error.code === "CHUNK_SIZE_MISMATCH" ||
      error.code === "CHUNK_HASH_MISMATCH" ||
      error.code === "CHUNK_ALREADY_UPLOADED")
  );
}
