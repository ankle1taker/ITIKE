import { mockProvider } from "./mock.provider.js";
import { africasTalkingProvider } from "./africasTalking.provider.js";

const KNOWN_PROVIDERS = new Set(["mock", "africas_talking"]);

let initialized = false;
let activeProvider = null;

const resolveProvider = () => {
  const name = process.env.NOTIFICATION_PROVIDER || "mock";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (!KNOWN_PROVIDERS.has(name)) {
    throw new Error(
      `Unknown NOTIFICATION_PROVIDER "${name}". Expected one of: ${[...KNOWN_PROVIDERS].join(", ")}`,
    );
  }

  // Note: unlike payments, notification provider=mock is allowed in production.
  // SMS is optional for V1 launch. The startup log warns when mock is active.
  if (name === "mock") {
    if (nodeEnv === "production") {
      console.warn(
        "[notifications] WARNING: provider=mock in production. SMS will be logged, not delivered.",
      );
    }
    return mockProvider;
  }

  if (name === "africas_talking") {
    const required = ["AFRICAS_TALKING_USERNAME", "AFRICAS_TALKING_API_KEY"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(
        `NOTIFICATION_PROVIDER=africas_talking missing env: ${missing.join(", ")}`,
      );
    }
    return africasTalkingProvider;
  }

  throw new Error(`Unreachable notification provider resolution for "${name}"`);
};

export const getProvider = () => {
  if (!initialized) {
    activeProvider = resolveProvider();
    initialized = true;
    console.log(`[notifications] provider=${activeProvider.name}`);
  }
  return activeProvider;
};