import { mockProvider } from "./mock.provider.js";
import { mtnMomoProvider } from "./mtnMomo.provider.js";
import { airtelMoneyProvider } from "./airtelMoney.provider.js";

const KNOWN_PROVIDERS = new Set(["mock", "mtn_momo", "airtel"]);

let initialized = false;
let activeProvider = null;

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
      throw new Error("PAYMENT_PROVIDER=mock requires MOCK_WEBHOOK_SECRET.");
    }
    return mockProvider;
  }

  if (name === "mtn_momo") {
    const required = [
      "MTN_MOMO_BASE_URL",
      "MTN_MOMO_SUBSCRIPTION_KEY",
      "MTN_MOMO_API_USER",
      "MTN_MOMO_API_KEY",
    ];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(
        `PAYMENT_PROVIDER=mtn_momo missing env: ${missing.join(", ")}`,
      );
    }
    return mtnMomoProvider;
  }

  if (name === "airtel") {
    const required = ["AIRTEL_BASE_URL", "AIRTEL_CLIENT_ID", "AIRTEL_CLIENT_SECRET"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(
        `PAYMENT_PROVIDER=airtel missing env: ${missing.join(", ")}`,
      );
    }
    return airtelMoneyProvider;
  }

  throw new Error(`Unreachable provider resolution for "${name}"`);
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