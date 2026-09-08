import app from "./app.js";
import prisma from "./config/database.js";

const PORT = process.env.PORT || 5000;

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