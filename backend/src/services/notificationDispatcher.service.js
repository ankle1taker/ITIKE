import prisma from "../config/database.js";
import { processNotification } from "./notification.service.js";

const INTERVAL_MS = 30 * 1000;
const MAX_ATTEMPTS = 3;

let timer = null;
let running = false;

const log = (...args) => console.log("[notif-dispatcher]", ...args);

const runOnce = async () => {
  if (running) return;
  running = true;
  try {
    const pending = await prisma.notification.findMany({
      where: {
        status: "PENDING",
        attempts: { lt: MAX_ATTEMPTS },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });

    if (pending.length === 0) return;

    for (const n of pending) {
      try {
        const result = await processNotification(n.id);
        if (result && !result.noop) {
          log(`notification=${n.id} status=${result.status}`);
        }
      } catch (err) {
        log(`notification=${n.id} failed: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
};

export const startNotificationDispatcher = () => {
  if (timer) return;
  log(`started (interval=${INTERVAL_MS}ms)`);
  runOnce().catch(() => {});
  timer = setInterval(runOnce, INTERVAL_MS);
};

export const stopNotificationDispatcher = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log("stopped");
  }
};