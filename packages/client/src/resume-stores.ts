import type { TorrinUploadState } from "@torrin/core";
import type { TorrinResumeStore } from "./types.js";

const STORAGE_PREFIX = "torrin_upload_";
const FILE_INDEX_KEY = "torrin_file_index";

export function createLocalStorageResumeStore(): TorrinResumeStore {
  function getFileIndex(): Record<string, string> {
    try {
      const data = localStorage.getItem(FILE_INDEX_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  function setFileIndex(index: Record<string, string>): void {
    localStorage.setItem(FILE_INDEX_KEY, JSON.stringify(index));
  }

  function loadState(uploadId: string): TorrinUploadState | null {
    const data = localStorage.getItem(STORAGE_PREFIX + uploadId);
    if (!data) return null;

    try {
      return JSON.parse(data) as TorrinUploadState;
    } catch {
      return null;
    }
  }

  return {
    save(uploadId: string, state: TorrinUploadState): void {
      localStorage.setItem(STORAGE_PREFIX + uploadId, JSON.stringify(state));
    },

    load(uploadId: string): TorrinUploadState | null {
      return loadState(uploadId);
    },

    remove(uploadId: string): void {
      const state = loadState(uploadId);
      localStorage.removeItem(STORAGE_PREFIX + uploadId);

      // Clean up all file index entries pointing to this upload
      const index = getFileIndex();
      for (const [key, value] of Object.entries(index)) {
        if (value === uploadId) {
          delete index[key];
        }
      }
      setFileIndex(index);
    },

    saveFileKey(fileKey: string, uploadId: string): void {
      const index = getFileIndex();
      index[fileKey] = uploadId;
      setFileIndex(index);
    },

    removeFileKey(fileKey: string): void {
      const index = getFileIndex();
      delete index[fileKey];
      setFileIndex(index);
    },

    findByFile(fileKey: string): TorrinUploadState | null {
      const index = getFileIndex();
      const uploadId = index[fileKey];
      if (!uploadId) return null;
      return loadState(uploadId);
    },
  };
}

export function createInMemoryResumeStore(): TorrinResumeStore {
  const uploads = new Map<string, TorrinUploadState>();
  const fileIndex = new Map<string, string>();

  return {
    save(uploadId: string, state: TorrinUploadState): void {
      uploads.set(uploadId, state);
    },

    load(uploadId: string): TorrinUploadState | null {
      return uploads.get(uploadId) ?? null;
    },

    remove(uploadId: string): void {
      uploads.delete(uploadId);

      // Clean up all file index entries pointing to this upload
      for (const [key, value] of fileIndex.entries()) {
        if (value === uploadId) {
          fileIndex.delete(key);
        }
      }
    },

    saveFileKey(fileKey: string, uploadId: string): void {
      fileIndex.set(fileKey, uploadId);
    },

    removeFileKey(fileKey: string): void {
      fileIndex.delete(fileKey);
    },

    findByFile(fileKey: string): TorrinUploadState | null {
      const uploadId = fileIndex.get(fileKey);
      if (!uploadId) return null;
      return uploads.get(uploadId) ?? null;
    },
  };
}
