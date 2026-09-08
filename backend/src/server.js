import express from "express";
import prisma from "./config/database.js";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      success: true,
      service: "Itike API",
      status: "healthy",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      service: "Itike API",
      status: "unhealthy",
      database: "disconnected",
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Itike API running on http://localhost:${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down Itike API...`);

  await prisma.$disconnect();

  server.close(() => {
    console.log("Itike API stopped.");
    process.exit(0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));