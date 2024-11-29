import OCRIntelligenceUseCases from "../usecases/ocr-intelligence.usecases.js";

export class OCRIntelligenceController {
  constructor() {
    this.ocrIntelligenceUseCases = new OCRIntelligenceUseCases();
  }

  async getAlertBasedonDoc(req, res) {
    console.log("Received request for document-based alert...");

    try {
      const { docURL, docType, infoToMatch } = req.body;
      if (!docURL || !docType || !infoToMatch) {
        return res.status(400).json({
          message: "docURL, docType, and infoToMatch are required.",
        });
      }

      console.log("Processing request with docURL:", docURL);
      console.log("Document type:", docType);

      let result; // Declare `result` with `let` for reassignment

      if (docType === "Valuation Report") {
        result = await this.ocrIntelligenceUseCases.getAlertBasedonDoc(
          docURL,
          infoToMatch
        );
      } else if (docType === "Bank Statement") {
        result = await this.ocrIntelligenceUseCases.getAlertBasedonStatement(
          docURL,
          infoToMatch
        );
      } else if (docType === "Pay Slip") {
        result =
          "Bro, There is no code for this, this requires working for each and every function";
      } else {
        return res.status(400).json({
          message: `Unsupported document type: ${docType}.`,
        });
      }
      console.log("Response generated successfully:", result);

      res.status(200).json(result);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ message: error.message });
    }
  }

  async checkDocumentType(req, res) {
    console.log("Received request for document type analysis...");
    try {
      const { docURL } = req.body;
      if (!docURL) {
        return res.status(400).json({ message: "docURL is required." });
      }

      console.log("Processing document type analysis for URL:", docURL);

      const result = await this.ocrIntelligenceUseCases.checkDocumentType(
        docURL
      );

      //console.log("Document type analysis completed successfully:", result);

      res.status(200).json(result);
    } catch (error) {
      console.error("Error analyzing document type:", error);
      res.status(500).json({ message: error.message });
    }
  }
}
