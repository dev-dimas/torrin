import express from "express";
import cors from "cors";
import { createTorrinExpressRouter } from "@torrin/server-express";
import { createLocalStorageDriver } from "@torrin/storage-local";
import { createInMemoryStore, TorrinService } from "@torrin/server";

const app = express();
const PORT = 3001;

// Upload TTL: 1 hour (for demo purposes, use 24 hours in production)
const UPLOAD_TTL_MS = 60 * 60 * 1000;

// Cleanup interval: every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

app.use(cors());
app.use(express.json());

const storage = createLocalStorageDriver({
  baseDir: "./uploads",
});

const store = createInMemoryStore();

// Create service for cleanup operations
const torrinService = new TorrinService({
  storage,
  store,
  defaultChunkSize: 1024 * 1024,
  uploadTtlMs: UPLOAD_TTL_MS,
});

const torrinRouter = createTorrinExpressRouter({
  storage,
  store,
  defaultChunkSize: 1024 * 1024, // 1MB chunks
  uploadTtlMs: UPLOAD_TTL_MS,
  onBeforeInit: (req) => {
    console.log(`[INIT] New upload: ${req.body.fileName} (${req.body.fileSize} bytes)`);
  },
  onBeforeChunk: (req) => {
    console.log(`[CHUNK] Upload ${req.params.uploadId} - chunk ${req.params.index}`);
  },
  onBeforeComplete: (req) => {
    console.log(`[COMPLETE] Upload ${req.params.uploadId} finalizing...`);
  },
});

app.use("/torrin/uploads", torrinRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "express" });
});

// Manual cleanup endpoint (for testing)
app.post("/admin/cleanup", async (_req, res) => {
  const result = await torrinService.cleanupExpiredUploads();
  console.log(`[CLEANUP] Cleaned ${result.cleaned} expired uploads`);
  if (result.errors.length > 0) {
    console.log(`[CLEANUP] Errors:`, result.errors);
  }
  res.json(result);
});

// Start periodic cleanup
setInterval(async () => {
  const result = await torrinService.cleanupExpiredUploads();
  if (result.cleaned > 0) {
    console.log(`[CLEANUP] Automatically cleaned ${result.cleaned} expired uploads`);
  }
  if (result.errors.length > 0) {
    console.log(`[CLEANUP] Errors:`, result.errors);
  }
}, CLEANUP_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`
🚀 Express Demo Server running!
   
   Health:  http://localhost:${PORT}/health
   Torrin:  http://localhost:${PORT}/torrin/uploads
   Cleanup: POST http://localhost:${PORT}/admin/cleanup
   
   Uploads will be saved to: ./uploads
   Upload TTL: ${UPLOAD_TTL_MS / 1000 / 60} minutes
   Auto cleanup every: ${CLEANUP_INTERVAL_MS / 1000 / 60} minutes
`);
});
