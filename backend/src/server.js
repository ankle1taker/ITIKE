const express = require("express");

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "Itike API",
    status: "healthy",
  });
});

app.listen(PORT, () => {
  console.log(`Itike API running on http://localhost:${PORT}`);
});