export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  size: number;
}

export function calculateChunks(fileSize: number, chunkSize: number): ChunkInfo[] {
  const chunks: ChunkInfo[] = [];
  let index = 0;
  let start = 0;

  while (start < fileSize) {
    const end = Math.min(start + chunkSize, fileSize);
    chunks.push({
      index,
      start,
      end,
      size: end - start,
    });
    index++;
    start = end;
  }

  return chunks;
}

export async function getChunkBlob(
  source: File | Blob | ArrayBuffer | Uint8Array,
  chunkInfo: ChunkInfo
): Promise<Blob> {
  if (source instanceof Blob) {
    return source.slice(chunkInfo.start, chunkInfo.end);
  }

  if (source instanceof ArrayBuffer) {
    return new Blob([source.slice(chunkInfo.start, chunkInfo.end)]);
  }

  if (source instanceof Uint8Array) {
    return new Blob([source.subarray(chunkInfo.start, chunkInfo.end)]);
  }

  throw new Error("Unsupported source type");
}

export function getFileKey(file: File | Blob, fileSize: number, fileName?: string): string {
  const name = file instanceof File ? file.name : fileName ?? "blob";
  const lastModified = file instanceof File ? file.lastModified : 0;
  return `${name}-${fileSize}-${lastModified}`;
}
