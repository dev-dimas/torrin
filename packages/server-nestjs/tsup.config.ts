import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  external: [
    "@torrin-kit/core",
    "@torrin-kit/server",
    "@nestjs/common",
    "@nestjs/core",
    "reflect-metadata",
    "rxjs",
  ],
});
