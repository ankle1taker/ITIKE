import { defineConfig } from "vitest/config";
import "dotenv/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
    // Run test files sequentially to avoid DB conflicts
    fileParallelism: false,
    pool: "forks",
  },
});