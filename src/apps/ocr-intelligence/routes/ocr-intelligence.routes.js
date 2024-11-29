import express from "express";
import { OCRIntelligenceController } from "../controllers/ocr-intelligence.controller.js";

const ocrIntelligenceRouter = express.Router();

const ocrIntelligenceController = new OCRIntelligenceController();

ocrIntelligenceRouter.post("/docBasedAlert", async (req, res) => {
  await ocrIntelligenceController.getAlertBasedonDoc(req, res);
});

ocrIntelligenceRouter.post("/docTypeusingAzure", async (req, res) => {
  await ocrIntelligenceController.checkDocumentType(req, res);
});

export default ocrIntelligenceRouter;
