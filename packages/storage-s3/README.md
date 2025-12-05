# @torrin-kit/storage-s3

S3-compatible storage driver for Torrin upload engine.

**Size:** 5.5 KB (1.5 KB gzipped)

Works with AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, and other S3-compatible services.

## Installation

```bash
npm install @torrin-kit/storage-s3 @aws-sdk/client-s3
```

## Usage

### AWS S3

```typescript
import { createS3StorageDriver } from "@torrin-kit/storage-s3";

const storage = createS3StorageDriver({
  bucket: "my-bucket",
  region: "us-east-1",
});
```

### With credentials

```typescript
const storage = createS3StorageDriver({
  bucket: "my-bucket",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

### MinIO

```typescript
const storage = createS3StorageDriver({
  bucket: "uploads",
  region: "us-east-1",
  endpoint: "http://localhost:9000",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
  },
});
```

### Cloudflare R2

```typescript
const storage = createS3StorageDriver({
  bucket: "my-bucket",
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
```

### DigitalOcean Spaces

```typescript
const storage = createS3StorageDriver({
  bucket: "my-space",
  region: "nyc3",
  endpoint: "https://nyc3.digitaloceanspaces.com",
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET,
  },
});
```

## API

### `createS3StorageDriver(options)`

```typescript
interface S3StorageOptions {
  bucket: string;
  region?: string; // Default: "us-east-1"
  endpoint?: string; // Custom endpoint for S3-compatible services
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  keyPrefix?: string; // Default: "uploads/"
  forcePathStyle?: boolean; // Required for MinIO
  s3ClientConfig?: S3ClientConfig;
  getObjectKey?: (session: TorrinUploadSession) => string;
}
```

## Key Generation

### Default pattern

```
uploads/2024/01/u_abc123.mp4
```

### Custom prefix

```typescript
const storage = createS3StorageDriver({
  bucket: "my-bucket",
  keyPrefix: "user-uploads/",
});
// Result: user-uploads/2024/01/u_abc123.mp4
```

### Custom key function

```typescript
const storage = createS3StorageDriver({
  bucket: "my-bucket",
  getObjectKey: (session) => {
    const userId = session.metadata?.userId;
    return `users/${userId}/${session.uploadId}/${session.fileName}`;
  },
});
// Result: users/123/u_abc123/video.mp4
```

## How It Works

This driver uses S3's native multipart upload:

1. **initUpload**: `CreateMultipartUploadCommand`
2. **writeChunk**: `UploadPartCommand` (each chunk = one part)
3. **finalizeUpload**: `CompleteMultipartUploadCommand`
4. **abortUpload**: `AbortMultipartUploadCommand`

Benefits:

- No temporary local storage needed
- Native S3 multipart = efficient large file handling
- Automatic cleanup on abort

## Storage Location

After completion:

```typescript
{
  type: "s3",
  bucket: "my-bucket",
  key: "uploads/2024/01/u_abc123.mp4",
  url: "https://my-bucket.s3.us-east-1.amazonaws.com/...",
  etag: "\"d41d8cd98f00b204e9800998ecf8427e\""
}
```

## IAM Permissions

Required S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateMultipartUpload",
        "s3:UploadPart",
        "s3:CompleteMultipartUpload",
        "s3:AbortMultipartUpload",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::my-bucket/*"
    }
  ]
}
```

## Cleanup

### S3 lifecycle rules

Set up lifecycle rules to clean incomplete multipart uploads:

```json
{
  "Rules": [
    {
      "ID": "AbortIncompleteMultipartUpload",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }
  ]
}
```

### AWS CLI

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "AbortIncompleteMultipartUpload",
      "Status": "Enabled",
      "Filter": {},
      "AbortIncompleteMultipartUpload": {
        "DaysAfterInitiation": 7
      }
    }]
  }'
```

## Example

```typescript
import express from "express";
import { createTorrinExpressRouter } from "@torrin-kit/server-express";
import { createS3StorageDriver } from "@torrin-kit/storage-s3";
import { createInMemoryStore } from "@torrin-kit/server";

const app = express();
app.use(express.json());

const storage = createS3StorageDriver({
  bucket: process.env.S3_BUCKET,
  region: process.env.AWS_REGION,
  keyPrefix: "uploads/",
});

app.use(
  "/torrin/uploads",
  createTorrinExpressRouter({
    storage,
    store: createInMemoryStore(),
  })
);

app.listen(3000);
```

## TypeScript

```typescript
import type { S3StorageOptions } from "@torrin-kit/storage-s3";
import type { TorrinStorageDriver } from "@torrin-kit/server";
```

## License

[Apache-2.0](LICENSE)
