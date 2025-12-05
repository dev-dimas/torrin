import { Module, DynamicModule, Provider, type Type, type InjectionToken } from "@nestjs/common";
import { TorrinService, type TorrinStorageDriver, type TorrinUploadStore } from "@torrin/server";
import { TorrinController } from "./torrin.controller.js";
import { TORRIN_OPTIONS, TORRIN_SERVICE } from "./constants.js";

export interface TorrinModuleOptions {
  basePath?: string;
  storage: TorrinStorageDriver;
  store: TorrinUploadStore;
  defaultChunkSize?: number;
  maxChunkSize?: number;
  uploadTtlMs?: number;
  global?: boolean;
}

export interface TorrinModuleAsyncOptions {
  imports?: Type<unknown>[];
  useFactory: (
    ...args: any[]
  ) => TorrinModuleOptions | Promise<TorrinModuleOptions>;
  inject?: InjectionToken[];
  global?: boolean;
}

@Module({})
export class TorrinModule {
  static forRoot(options: TorrinModuleOptions): DynamicModule {
    const serviceProvider: Provider = {
      provide: TORRIN_SERVICE,
      useFactory: () => {
        return new TorrinService({
          storage: options.storage,
          store: options.store,
          defaultChunkSize: options.defaultChunkSize,
          maxChunkSize: options.maxChunkSize,
          uploadTtlMs: options.uploadTtlMs,
        });
      },
    };

    const optionsProvider: Provider = {
      provide: TORRIN_OPTIONS,
      useValue: options,
    };

    return {
      module: TorrinModule,
      global: options.global ?? false,
      controllers: [TorrinController],
      providers: [serviceProvider, optionsProvider],
      exports: [TORRIN_SERVICE],
    };
  }

  static forRootAsync(options: TorrinModuleAsyncOptions): DynamicModule {
    const serviceProvider: Provider = {
      provide: TORRIN_SERVICE,
      useFactory: async (...args: unknown[]) => {
        const moduleOptions = await options.useFactory(...args);
        return new TorrinService({
          storage: moduleOptions.storage,
          store: moduleOptions.store,
          defaultChunkSize: moduleOptions.defaultChunkSize,
          maxChunkSize: moduleOptions.maxChunkSize,
          uploadTtlMs: moduleOptions.uploadTtlMs,
        });
      },
      inject: options.inject ?? [],
    };

    const optionsProvider: Provider = {
      provide: TORRIN_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: TorrinModule,
      global: options.global ?? false,
      imports: options.imports ?? [],
      controllers: [TorrinController],
      providers: [serviceProvider, optionsProvider],
      exports: [TORRIN_SERVICE],
    };
  }
}
