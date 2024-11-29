import OCRIntelligenceRepository from "../repositories/ocr-intelligence.repository.js";
import { matchDocumentFields } from "../utils/ocr-intelligence.utils.js";

class OCRIntelligenceUseCases {
  constructor() {
    this.ocrIntelligenceRepository = new OCRIntelligenceRepository();
  }

  async getAlertBasedonStatement(docURL, infoToMatch) {
    try {
      console.log("Processing Bank Statement...");

      const { Applicants, statementDate } = infoToMatch;

      // Call the repository to analyze the statement
      const result = await this.ocrIntelligenceRepository.analyzeBankStatement(
        docURL,
        Applicants,
        statementDate
      );

      // Directly return the JSON result to the controller
      return result;
    } catch (error) {
      console.error("Error in document analysis:", error);
      return {
        isAlert: true,
        AlertMessage:
          "Error analyzing Bank Statement. Potential causes include: the document size exceeds Azure limits, or the document contains no readable text (e.g., it is an image with no text in it).",
      };
    }
  }

  async getAlertBasedonDoc(docURL, infoToMatch) {
    console.log("Starting document analysis...");

    try {
      const resultJSON = await this.ocrIntelligenceRepository.analyzeDocument(
        docURL
      );
      console.log("Document analyzed successfully.");

      const { isAlert, AlertMessage } = matchDocumentFields(
        infoToMatch,
        resultJSON
      );

      // console.log("Match result:", { isMatched, messageBody });

      return {
        isAlert,
        AlertMessage,
      };
    } catch (error) {
      console.error("Error in document analysis:", error);
      return {
        isAlert: true,
        AlertMessage:
          "Error analyzing Valuation Report. Potential causes include: the document size exceeds Azure limits, or the document contains no readable text (e.g., it is an image with no text in it).",
      };
    }
  }

  async checkDocumentType(docURL) {
    console.log("Starting document type analysis...");

    try {
      const analyzedDocType =
        await this.ocrIntelligenceRepository.analyzeDocType(docURL);
      //console.log("Document type analyzed successfully.");

      return {
        DocType: analyzedDocType,
      };
    } catch (error) {
      console.error("Error in document type analysis:", error);
      return {
        isAlert: true,
        AlertMessage:
          "Error analyzing document type. Potential causes include: the document size exceeds Azure limits, or the document contains no readable text (e.g., it is an image with no text in it).",
      };
    }
  }
}

export default OCRIntelligenceUseCases;
