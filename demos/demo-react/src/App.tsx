import { useState, useRef, useCallback, useEffect } from "react";
import {
  createTorrinClient,
  createLocalStorageResumeStore,
  type TorrinUpload,
  type TorrinProgress,
  type UploadClientStatus,
} from "@torrin/client";

const torrin = createTorrinClient({
  endpoint: "/torrin/uploads",
  resumeStore: createLocalStorageResumeStore(),
  maxConcurrency: 3,
});

interface UploadItem {
  id: string;
  file: File;
  upload: TorrinUpload;
  progress: TorrinProgress | null;
  status: UploadClientStatus;
  error: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function App() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [serverType, setServerType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/health")
      .then((res) => res.json())
      .then((data) => setServerType(data.server))
      .catch(() => setServerType("unknown"));
  }, []);

  const startUpload = useCallback((file: File) => {
    const upload = torrin.createUpload({
      file,
      metadata: { uploadedAt: new Date().toISOString() },
    });

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const item: UploadItem = {
      id,
      file,
      upload,
      progress: null,
      status: "initializing",
      error: null,
    };

    setUploads((prev) => [...prev, item]);

    upload.on("progress", (progress) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, progress } : u))
      );
    });

    upload.on("status", (status) => {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, status: status as UploadClientStatus } : u
        )
      );
    });

    upload.on("error", (err) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, error: err.message } : u))
      );
    });

    upload.start().catch(() => {
      // Error already handled by error event
    });
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach(startUpload);
      // Reset file input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [startUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handlePause = (item: UploadItem) => {
    if (item.status === "paused") {
      item.upload.resume();
    } else {
      item.upload.pause();
    }
  };

  const handleCancel = async (item: UploadItem) => {
    await item.upload.cancel();
    // File key is automatically removed by client's removeFileKey
    // so the same file can be uploaded again immediately
    setUploads((prev) => prev.filter((u) => u.id !== item.id));
  };

  const handleRemove = (item: UploadItem) => {
    setUploads((prev) => prev.filter((u) => u.id !== item.id));
  };

  return (
    <div className="container">
      <h1>
        Torrin Demo
        {serverType && (
          <span className={`server-badge ${serverType}`}>{serverType}</span>
        )}
      </h1>
      <p className="subtitle">Resumable chunked file uploads</p>

      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="dropzone-text">
          <strong>Click to upload</strong> or drag and drop
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="file-input"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {uploads.map((item) => (
        <div key={item.id} className="upload-card">
          <div className="upload-header">
            <div>
              <div className="upload-filename">{item.file.name}</div>
              <div className="upload-size">{formatBytes(item.file.size)}</div>
            </div>
            <span className={`upload-status ${item.status}`}>
              {item.status}
            </span>
          </div>

          {item.error && <div className="error-message">{item.error}</div>}

          <div className="progress-bar">
            <div
              className={`progress-fill ${
                item.status === "completed" ? "completed" : ""
              }`}
              style={{ width: `${item.progress?.percentage ?? 0}%` }}
            />
          </div>

          <div className="upload-details">
            <span>
              {item.progress
                ? `${item.progress.chunksCompleted} / ${item.progress.totalChunks} chunks`
                : "Preparing..."}
            </span>
            <span>{item.progress?.percentage ?? 0}%</span>
          </div>

          {item.status !== "completed" &&
            item.status !== "failed" &&
            item.status !== "canceled" && (
              <div className="upload-actions">
                <button
                  className="btn btn-pause"
                  onClick={() => handlePause(item)}
                  disabled={
                    item.status === "initializing" ||
                    item.status === "completing"
                  }
                >
                  {item.status === "paused" ? "Resume" : "Pause"}
                </button>
                <button
                  className="btn btn-cancel"
                  onClick={() => handleCancel(item)}
                >
                  Cancel
                </button>
              </div>
            )}

          {(item.status === "completed" || item.status === "failed") && (
            <div className="upload-actions">
              <button
                className="btn btn-remove"
                onClick={() => handleRemove(item)}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
