import { DEFAULT_CHUNK_SIZE, MIN_CHUNK_SIZE, MAX_CHUNK_SIZE, UPLOAD_ID_PREFIX } from "./constants.js";

export function generateUploadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${UPLOAD_ID_PREFIX}${timestamp}${random}`;
}

export function calculateTotalChunks(fileSize: number, chunkSize: number): number {
  return Math.ceil(fileSize / chunkSize);
}

export function normalizeChunkSize(desired: number | undefined, fileSize: number): number {
  let size = desired ?? DEFAULT_CHUNK_SIZE;

  size = Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, size));

  if (size > fileSize) {
    size = fileSize;
  }

  return size;
}

export function getMissingChunks(totalChunks: number, receivedChunks: number[]): number[] {
  const received = new Set(receivedChunks);
  const missing: number[] = [];

  for (let i = 0; i < totalChunks; i++) {
    if (!received.has(i)) {
      missing.push(i);
    }
  }

  return missing;
}

export function getExpectedChunkSize(
  chunkIndex: number,
  totalChunks: number,
  fileSize: number,
  chunkSize: number
): number {
  if (chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new Error(`Chunk index ${chunkIndex} out of range [0, ${totalChunks - 1}]`);
  }

  if (chunkIndex === totalChunks - 1) {
    const remainder = fileSize % chunkSize;
    return remainder === 0 ? chunkSize : remainder;
  }

  return chunkSize;
}

export function isValidUploadId(uploadId: string): boolean {
  return (
    typeof uploadId === "string" &&
    uploadId.startsWith(UPLOAD_ID_PREFIX) &&
    uploadId.length > UPLOAD_ID_PREFIX.length
  );
}

export async function hashBuffer(
  buffer: ArrayBuffer,
  algorithm: "SHA-256" | "SHA-1" = "SHA-256"
): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  throw new Error("Web Crypto API not available");
}

export async function hashStream(
  stream: ReadableStream<Uint8Array>,
  algorithm: "SHA-256" | "SHA-1" = "SHA-256"
): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return hashBuffer(combined.buffer, algorithm);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

export function calculateProgress(
  bytesUploaded: number,
  totalBytes: number
): number {
  if (totalBytes === 0) return 100;
  return Math.min(100, Math.round((bytesUploaded / totalBytes) * 100));
}
