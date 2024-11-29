import { analyzeDocumentWithAzure } from "../utils/ocr-intelligence.utils.js";
import { analyzeDocTypeWithAzure } from "../utils/ocr-intelligence.utils.js";
import {
  searchApplicant,
  checkSubmittedDate,
  analyzeStatementWithAzure,
} from "../utils/ocr-intelligence.utils.js";

export class OCRIntelligenceRepository {
  async analyzeBankStatement(docURL, Applicants, statementDate) {
    try {
      console.log("Analyzing Bank Statement...");

      // Extract data from the document
      const resultContent = await analyzeStatementWithAzure(docURL);

      // Step 1: Check Submission Date
      const { lessThan3MonthOld, statementEndElement } =
        await checkSubmittedDate(statementDate, resultContent);

      // Step 2: Search for Applicant
      const resultApplicant = await searchApplicant(resultContent, Applicants);

      // Step 3: Generate the message based on applicant search
      let AlertMessage;
      let isAlert;

      if (!resultApplicant || resultApplicant.length === 0) {
        // If no matching applicant is found
        AlertMessage = `The given Bank Statement doesn't belong to any of the given applicants (${Applicants.join(
          ", "
        )}).`;
        isAlert = true;
      } else {
        // If a matching applicant is found
        AlertMessage = lessThan3MonthOld
          ? `Given Bank Statement is of ${resultApplicant} and was submitted on ${statementEndElement}, which is under 3 months from the given date ${statementDate}.`
          : `Given Bank Statement is of ${resultApplicant} and was submitted on ${statementEndElement}, which is not under 3 months from the given date ${statementDate}.`;
        isAlert = !lessThan3MonthOld;
      }

      // Return the desired JSON
      return {
        isAlert,
        AlertMessage,
      };
    } catch (error) {
      console.error("Error in analyzeBankStatement:", error);
      throw new Error("Error processing Bank Statement.");
    }
  }

  async analyzeDocument(docURL) {
    try {
      // Call the utility function to analyze the document
      const analyzedData = await analyzeDocumentWithAzure(docURL);
      return analyzedData;
    } catch (error) {
      console.error("Error in analyzeDocument:", error);
      throw new Error("Error analyzing document with Azure");
    }
  }
  async analyzeDocType(docURL) {
    try {
      console.log("Calling Azure OCR for document type analysis...");

      const analyzedData = await analyzeDocTypeWithAzure(docURL);

      // console.log("Document type analysis result from Azure:", analyzedData);

      return analyzedData;
    } catch (error) {
      console.error("Error in analyzeDocType:", error);
      throw new Error("Error analyzing document type with Azure");
    }
  }
}

export default OCRIntelligenceRepository;
