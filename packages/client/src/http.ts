import { TorrinError, HTTP_HEADERS } from "@torrin/core";
import type { InitUploadResponse, ChunkUploadResponse, StatusResponse } from "./types.js";

export interface HttpClientOptions {
  endpoint: string;
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
}

export class HttpClient {
  private readonly endpoint: string;
  private readonly getHeaders: () => Record<string, string> | Promise<Record<string, string>>;

  constructor(options: HttpClientOptions) {
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.getHeaders = options.headers ?? (() => ({}));
  }

  async initUpload(input: {
    fileName?: string;
    fileSize: number;
    mimeType?: string;
    metadata?: Record<string, unknown>;
    desiredChunkSize?: number;
  }): Promise<InitUploadResponse> {
    const headers = await this.getHeaders();

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(input),
    });

    return this.handleResponse<InitUploadResponse>(response);
  }

  async uploadChunk(
    uploadId: string,
    index: number,
    chunk: Blob | ArrayBuffer | Uint8Array,
    hash?: string
  ): Promise<ChunkUploadResponse> {
    const headers = await this.getHeaders();
    const body = chunk instanceof Blob ? chunk : new Blob([chunk]);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "Content-Length": body.size.toString(),
      ...headers,
    };

    if (hash) {
      requestHeaders[HTTP_HEADERS.CHUNK_HASH] = hash;
    }

    const response = await fetch(`${this.endpoint}/${uploadId}/chunks/${index}`, {
      method: "PUT",
      headers: requestHeaders,
      body,
    });

    return this.handleResponse<ChunkUploadResponse>(response);
  }

  async getStatus(uploadId: string): Promise<StatusResponse> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.endpoint}/${uploadId}/status`, {
      method: "GET",
      headers,
    });

    return this.handleResponse<StatusResponse>(response);
  }

  async complete(uploadId: string, hash?: string): Promise<unknown> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.endpoint}/${uploadId}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({ hash }),
    });

    return this.handleResponse(response);
  }

  async abort(uploadId: string): Promise<void> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.endpoint}/${uploadId}`, {
      method: "DELETE",
      headers,
    });

    if (!response.ok && response.status !== 404) {
      await this.handleResponse(response);
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorData: { error?: { code?: string; message?: string; details?: unknown } } | null =
        null;

      try {
        errorData = await response.json();
      } catch {
        // ignore parse errors
      }

      const code = errorData?.error?.code ?? "NETWORK_ERROR";
      const message = errorData?.error?.message ?? `HTTP ${response.status}: ${response.statusText}`;

      throw new TorrinError(code as any, message, errorData?.error?.details);
    }

    return response.json() as Promise<T>;
  }
}
