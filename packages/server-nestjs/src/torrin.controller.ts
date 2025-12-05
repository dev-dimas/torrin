import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpStatus,
  HttpCode,
  Inject,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { TorrinError, HTTP_HEADERS, type TorrinSessionInitInput } from "@torrin/core";
import type { TorrinService } from "@torrin/server";
import { TORRIN_SERVICE } from "./constants.js";

interface InitUploadDto {
  fileName?: string;
  fileSize: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  desiredChunkSize?: number;
}

interface CompleteUploadDto {
  hash?: string;
}

@Controller("torrin/uploads")
export class TorrinController {
  constructor(
    @Inject(TORRIN_SERVICE) private readonly torrinService: TorrinService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async initUpload(@Body() body: InitUploadDto) {
    try {
      const input: TorrinSessionInitInput = {
        fileName: body.fileName,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        metadata: body.metadata,
        desiredChunkSize: body.desiredChunkSize,
      };

      const session = await this.torrinService.initUpload(input);

      return {
        uploadId: session.uploadId,
        fileName: session.fileName,
        fileSize: session.fileSize,
        mimeType: session.mimeType,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        metadata: session.metadata,
        status: session.status,
      };
    } catch (error) {
      this.handleError(error);
    }
  }

  @Put(":uploadId/chunks/:index")
  async uploadChunk(
    @Param("uploadId") uploadId: string,
    @Param("index") indexStr: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    try {
      const index = parseInt(indexStr, 10);
      const size = parseInt(req.headers["content-length"] ?? "0", 10);
      const hash = req.headers[HTTP_HEADERS.CHUNK_HASH] as string | undefined;

      if (isNaN(index)) {
        throw new TorrinError("INVALID_REQUEST", "Invalid chunk index");
      }

      if (size <= 0) {
        throw new TorrinError("INVALID_REQUEST", "Content-Length header is required");
      }

      await this.torrinService.handleChunk({
        uploadId,
        index,
        size,
        hash,
        stream: req,
      });

      res.status(HttpStatus.OK).json({
        uploadId,
        receivedIndex: index,
        status: "in_progress",
      });
    } catch (error) {
      this.handleErrorResponse(error, res);
    }
  }

  @Get(":uploadId/status")
  async getStatus(@Param("uploadId") uploadId: string) {
    try {
      return await this.torrinService.getStatus(uploadId);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post(":uploadId/complete")
  async completeUpload(
    @Param("uploadId") uploadId: string,
    @Body() body: CompleteUploadDto
  ) {
    try {
      return await this.torrinService.completeUpload(uploadId, body.hash);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete(":uploadId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async abortUpload(@Param("uploadId") uploadId: string) {
    try {
      await this.torrinService.abortUpload(uploadId);
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof TorrinError) {
      const { HttpException } = require("@nestjs/common");
      throw new HttpException(error.toJSON(), error.statusCode);
    }
    throw error;
  }

  private handleErrorResponse(error: unknown, res: Response): void {
    if (error instanceof TorrinError) {
      res.status(error.statusCode).json(error.toJSON());
    } else {
      console.error("Torrin internal error:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "An internal error occurred",
        },
      });
    }
  }
}
