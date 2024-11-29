import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import ocrIntelligenceRouter from "./src/apps/ocr-intelligence/routes/ocr-intelligence.routes.js";
import setupSwagger from "./src/infrastructure/config/swaggerConfig.js";

const app = express();

app.use(express.json());
app.use("/api/ocr", ocrIntelligenceRouter);

// Setup Swagger UI
setupSwagger(app);

// Serve the index.html file for the root URL
app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "src/frontend/index.html"
    )
  );
});

const PORT = process.env.PORT || 3300;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Backend is live on http://localhost:${PORT}`);
  console.log(`Swagger is live on http://localhost:${PORT}/api-docs`);
});
