import express from "express";
import prisma from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";
import platformRoutes from "./routes/platform.routes.js";
import companyRoutes from "./routes/company.routes.js";
import publicRoutes from "./routes/public.routes.js";

const app = express();

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

app.use("/api/auth", authRoutes);
app.use("/api/platform", platformRoutes);
app.use("/api/company", companyRoutes);
app.use("/api", publicRoutes);

app.use((error, req, res, next) => {
  console.error(error);

  if (error.name === "ZodError") {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      errors: error.issues,
    });
  }

  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 ? "Internal server error." : error.message,
  });
});

export default app;