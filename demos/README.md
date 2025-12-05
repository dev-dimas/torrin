# Torrin Demos

Working examples demonstrating Torrin upload engine.

## Structure

```
demos/
├── demo-express/     # Express.js backend
├── demo-nestjs/      # NestJS backend
└── demo-react/       # React frontend
```

## Quick Start

### 1. Build packages

```bash
# From root directory
pnpm install
pnpm build
```

### 2. Run backend (choose one)

**Express:**

```bash
cd demos/demo-express
pnpm dev
```

**NestJS:**

```bash
cd demos/demo-nestjs
pnpm dev
```

Server starts at `http://localhost:3001`

### 3. Run frontend

```bash
cd demos/demo-react
pnpm dev
```

Frontend starts at `http://localhost:5173`

### 4. Test

Open `http://localhost:5173` and upload a file.

## Features

### Frontend (React)

- Drag & drop file upload
- Multiple file upload
- Real-time progress (per-chunk)
- Pause / Resume / Cancel
- Resumable uploads (localStorage)
- Auto-detect backend type (Express/NestJS)

### Backend (Express/NestJS)

- Local filesystem storage
- In-memory session store
- Upload TTL: 60 minutes
- Auto cleanup every 10 minutes
- Manual cleanup endpoint: `POST /admin/cleanup`

## Endpoints

| Method   | Path                                | Description       |
| -------- | ----------------------------------- | ----------------- |
| `GET`    | `/health`                           | Health check      |
| `POST`   | `/torrin/uploads`                   | Initialize upload |
| `PUT`    | `/torrin/uploads/:id/chunks/:index` | Upload chunk      |
| `GET`    | `/torrin/uploads/:id/status`        | Get status        |
| `POST`   | `/torrin/uploads/:id/complete`      | Complete upload   |
| `DELETE` | `/torrin/uploads/:id`               | Abort upload      |
| `POST`   | `/admin/cleanup`                    | Trigger cleanup   |

## Configuration

### Environment

Create `.env` in backend demo:

```env
PORT=3001
UPLOAD_DIR=./uploads
UPLOAD_TTL_MS=3600000
CLEANUP_INTERVAL_MS=600000
```

### Frontend proxy

The React demo proxies `/torrin` and `/health` to `http://localhost:3001` via Vite config.

## File Structure

### demo-express

```
demo-express/
├── src/
│   └── index.ts        # Express server
├── package.json
└── tsconfig.json
```

### demo-nestjs

```
demo-nestjs/
├── src/
│   ├── app.module.ts       # App module with TorrinModule
│   ├── admin.controller.ts # Cleanup endpoint
│   └── main.ts             # Bootstrap
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### demo-react

```
demo-react/
├── src/
│   ├── App.tsx         # Main component
│   ├── index.css       # Styles
│   └── main.tsx        # Entry point
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Screenshots

```
┌─────────────────────────────────────────────┐
│  Torrin Demo                     [express]  │
│  Resumable chunked file uploads             │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │                                       │  │
│  │   Click to upload or drag and drop    │  │
│  │                                       │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  video.mp4                  uploading │  │
│  │  256 MB                               │  │
│  │  ████████████░░░░░░░░░░░░░░░░░ 45%    │  │
│  │  45 / 100 chunks                      │  │
│  │  [Pause]  [Cancel]                    │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │  document.pdf               completed │  │
│  │  5.2 MB                               │  │
│  │  █████████████████████████████ 100%   │  │
│  │  5 / 5 chunks                         │  │
│  │  [Remove]                             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## License

[Apache-2.0](LICENSE)
