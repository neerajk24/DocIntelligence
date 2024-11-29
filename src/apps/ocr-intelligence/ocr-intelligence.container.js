import { createContainer, asClass } from "awilix";
import OCRIntelligenceRepository from "./repositories/ocr-intelligence.repository.js";
import OCRIntelligenceUseCases from "./usecases/ocr-intelligence.usecases.js";
import OCRIntelligenceController from "./controllers/ocr-intelligence.controller.js";

const documentContainer = createContainer();

OCRIntelligenceContainer.register({
  DocumentRepository: asClass(DocumentRepository).singleton(),
  documentUseCases: asClass(DocumentUseCases).singleton(),
  documentController: asClass(DocumentController).singleton(),
});

export default OCRIntelligenceContainer;
