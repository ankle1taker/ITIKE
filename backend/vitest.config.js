import { defineConfig } from "vitest/config";
import "dotenv/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    env: {
      RATE_LIMIT_DISABLED: "true",
      NODE_ENV: "test",
    },
  },
});