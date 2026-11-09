import { mockProvider } from "./mock.provider.js";

const KNOWN_PROVIDERS = new Set(["mock", "mtn_momo", "airtel"]);

let initialized = false;
let activeProvider = null;

/**
 * Resolve the active provider once at startup.
 * Real providers (mtn_momo, airtel) are NOT yet implemented — attempting to
 * use them here throws at startup with a clear error, which is correct.
 * Module 9b adds them.
 */
const resolveProvider = () => {
  const name = process.env.PAYMENT_PROVIDER || "mock";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (!KNOWN_PROVIDERS.has(name)) {
    throw new Error(
      `Unknown PAYMENT_PROVIDER "${name}". Expected one of: ${[...KNOWN_PROVIDERS].join(", ")}`,
    );
  }

  if (nodeEnv === "production" && name === "mock") {
    throw new Error(
      "PAYMENT_PROVIDER=mock is not allowed when NODE_ENV=production. " +
        "Set PAYMENT_PROVIDER to a real provider before deploying.",
    );
  }

  if (name === "mock") {
    if (!process.env.MOCK_WEBHOOK_SECRET) {
      throw new Error(
        "PAYMENT_PROVIDER=mock requires MOCK_WEBHOOK_SECRET in the environment.",
      );
    }
    return mockProvider;
  }

  // Real providers come in module 9b. Until then, refuse to start.
  throw new Error(
    `PAYMENT_PROVIDER="${name}" is not yet implemented. ` +
      `Only "mock" is supported in this build (module 9a).`,
  );
};

export const getProvider = () => {
  if (!initialized) {
    activeProvider = resolveProvider();
    initialized = true;
    // eslint-disable-next-line no-console
    console.log(`[payments] provider=${activeProvider.name}`);
  }
  return activeProvider;
};