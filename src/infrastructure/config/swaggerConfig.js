// src/infrastructure/config/swaggerConfig.js
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

// Load the Swagger YAML file
const swaggerDocument = YAML.load("./src/docs/swagger.yaml");

const setupSwagger = (app) => {
  // Setup Swagger UI at /api-docs
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};

export default setupSwagger;
