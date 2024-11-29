import {
  AzureKeyCredential,
  DocumentAnalysisClient,
} from "@azure/ai-form-recognizer";
import dotenv from "dotenv";

dotenv.config();

//############################# Get Data For Matching

export async function analyzeStatementWithAzure(docURL) {
  try {
    // console.log("***analysis of Document for Bank Statement");
    const endpoint = process.env.DOC_INTEL_ENDPOINT;
    const key = process.env.DOC_INTEL_KEY;

    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );

    // Analyze the document using the "general-document" model
    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      docURL
    );

    // Wait for the analysis to complete
    const result = await poller.pollUntilDone();

    const resultContent = [];

    // Destructure key components from the result
    const { keyValuePairs, tables, paragraphs, styles, content } = result;

    // Process key-value pairs
    if (keyValuePairs.length > 0) {
      for (const { value } of keyValuePairs) {
        if (value?.content) {
          resultContent.push(value.content); // Add value to resultContent if available
        }
      }
    }

    // Process tables
    if (tables.length > 0) {
      for (const table of tables) {
        for (const cell of table.cells) {
          if (cell.content) {
            resultContent.push(cell.content); // Add cell content to resultContent
          }
        }
      }
    }

    // Process paragraphs
    if (paragraphs.length > 0) {
      for (const paragraph of paragraphs) {
        if (paragraph.content) {
          resultContent.push(paragraph.content); // Add paragraph content to resultContent
        }
      }
    }

    // Log and return resultContent
    //console.log("Extracted Content:", resultContent);
    return resultContent;
  } catch (error) {
    console.error("Error in analyzeDocumentWithAzure:", error);
    throw new Error("Azure OCR analysis failed");
  }
}

//############################# For Bank Statement

export async function checkSubmittedDate(statementDate, resultContent) {
  try {
    // console.log("Extracted Content to Search from: ", resultContent);

    const monthMap = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };

    function convertToDateFormat(dateString) {
      // Check if the string contains alphabetic characters (month names)
      if (/[a-zA-Z]/.test(dateString)) {
        // Normalize the string (replace month names with numbers)
        let normalizedDate = dateString.toLowerCase();
        for (const [month, monthNumber] of Object.entries(monthMap)) {
          normalizedDate = normalizedDate.replace(
            new RegExp(month, "i"),
            monthNumber
          );
        }

        // Remove all non-numeric characters and normalize spaces
        normalizedDate = normalizedDate
          .replace(/[^\d\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Split into day, month, and year
        const [day, month, year] = normalizedDate.split(" ");

        // Return the date in DD-MM-YYYY format
        return `${day.padStart(2, "0")}-${month}-${year}`;
      } else {
        // If no alphabetic characters, assume it's in the format DD/MM/YYYY or DD-MM-YYYY
        // Normalize by removing any non-numeric characters
        const normalizedDate = dateString.replace(/[^\d\/\-]/g, "");

        // Split into day, month, and year
        const [day, month, year] = normalizedDate.split(/\/|\-/);

        // Return the date in DD-MM-YYYY format
        return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`;
      }
    }

    function isDateOlderThan3Months(statementDate, statementEndDate) {
      // Convert both dates to Date objects

      function isISODate(dateString) {
        return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(dateString);
      }

      let statementDateObj;
      if (isISODate(statementDate)) {
        // If statementDate is in ISO format, use it directly
        statementDateObj = new Date(statementDate);
      } else {
        // Otherwise, convert it to the desired format
        const conStatementDate = convertToDateFormat(statementDate);
        statementDateObj = new Date(conStatementDate);
      }

      // Always convert statementEndDate
      const conStatementEndDate = convertToDateFormat(statementEndDate);
      const statementEndDateObj = new Date(conStatementEndDate);

      // console.log(
      //   "comparing ",
      //   statementEndDateObj,
      //   " with given date of ",
      //   statementDateObj
      // );

      // Calculate the difference in months
      const monthsDifference =
        (statementDateObj.getFullYear() - statementEndDateObj.getFullYear()) *
          12 +
        (statementDateObj.getMonth() - statementEndDateObj.getMonth());

      // If the difference is greater than 3 months, return false
      return monthsDifference <= 3;
    }

    // Regex patterns to match date ranges in various formats
    const dateRangePatterns = [
      // '02 March 2024 to 02 April 2024', '2 March 2024 to 12 April 2024', '22 MAR 2024 to 22 APR 2024'
      /(\d{1,2}(?:st|nd|rd|th)?\s\w+\s\d{4})\s(?:to|-)\s(\d{1,2}(?:st|nd|rd|th)?\s\w+\s\d{4})/i,

      // '29/02/2024 - 31/05/2024', '29/2/2024 - 1/11/2024'
      /(\d{1,2}\/\d{1,2}\/\d{4})\s(?:to|-)\s(\d{1,2}\/\d{1,2}\/\d{4})/i,

      // '23.2.2024 - 1.11.2024'
      /(\d{1,2}\.\d{1,2}\.\d{4})\s(?:to|-)\s(\d{1,2}\.\d{1,2}\.\d{4})/i,

      // '10 February to 9 March 2024', '1 April 2024 to 4 June 2024'
      /(\d{1,2}\s\w+)(?:\s\d{4})?\s(?:to|-)\s(\d{1,2}\s\w+\s\d{4})/i,

      // '16th Apr 2024 to 15th May 2024', '4th Apr 2024 to 3rd May 2024', '14th Apr 2024 to 3rd May 2024'
      /(\d{1,2}(?:st|nd|rd|th)?\s\w+\s\d{4})\s(?:to|-)\s(\d{1,2}(?:st|nd|rd|th)?\s\w+\s\d{4})/i,
    ];

    let statementTermElement = null;
    let statementEndElement = null;

    // Iterate over content to find matching elements
    for (const element of resultContent) {
      for (const pattern of dateRangePatterns) {
        const match = pattern.exec(element);
        if (match) {
          statementTermElement = element;
          statementEndElement = match[2]; // Extract the end date from the second capture group
          // console.log("Statement Term Element:", statementTermElement);
          // console.log("Statement End Date:", statementEndElement);
          break; // Stop checking patterns once a match is found
        }
      }
      if (statementTermElement) break; // Stop checking content once a match is found
    }

    // Check if we found the required element
    if (!statementTermElement) {
      throw new Error("No valid date range found in the content.");
    }
    // console.log("Statement Date:", statementDate);
    // console.log("Statement End Date:", statementEndElement);

    // Check if the statementEndElement is older than 3 months
    const isOlderThan3Months = !isDateOlderThan3Months(
      statementDate,
      statementEndElement
    );
    // console.log("isOlderThan3Months", isOlderThan3Months);
    return {
      lessThan3MonthOld: !isOlderThan3Months,
      statementEndElement: statementEndElement,
    };
  } catch (error) {
    console.error("Error in checkSubmittedDate:", error);
    throw error;
  }
}

export async function searchApplicant(resultContent, Applicants) {
  const resultApplicants = [];

  // Helper function to convert names to base form
  function convertNameToBaseForm(name) {
    const normalized = name
      .toLowerCase() // Convert to lowercase
      .replace(/\b(mrs?|mr|ms|and|&)\b/g, "") // Remove titles and conjunctions
      .replace(/[^\w\s]/g, "") // Remove special symbols
      .replace(/\s+/g, " ") // Normalize spaces
      .trim(); // Trim extra spaces from both ends

    // Add a space at the beginning for better token isolation
    return ` ${normalized}`;
  }

  // Check if all tokens from baseApplicantName are in baseContent
  function areAllTokensPresent(baseApplicantName, baseContent) {
    // Split baseApplicantName into tokens (e.g., " rajat r s" -> ["rajat", "r", "s"])
    const tokens = baseApplicantName.trim().split(" ");

    // Check if each token exists in baseContent
    return tokens.every((token) => baseContent.includes(` ${token}`));
  }

  // Loop through each applicant
  for (let applicant of Applicants) {
    let resultElement = applicant;
    // console.log("Applicant i am searching now : ", applicant);
    // Convert applicant's name to base form
    const baseApplicantName = convertNameToBaseForm(applicant);
    // console.log(
    //   "Base form of Applicant i am searching now : ",
    //   baseApplicantName
    // );

    // Loop through resultContent and check for the base name match
    for (let content of resultContent) {
      // Convert content to base form
      const baseContent = convertNameToBaseForm(content);

      // Check if all tokens from the applicant's name are present in the content
      if (areAllTokensPresent(baseApplicantName, baseContent)) {
        // console.log("Content which matched given name : ", baseContent);
        resultApplicants.push(resultElement);
        break; // Stop once a match is found for this applicant
      }
    }
  }

  // console.log("Name Found in Bank Statement is/are : ", resultApplicants);
  return resultApplicants;
}

//############################# For isAlert & AlertMessage

export async function analyzeDocumentWithAzure(docURL) {
  try {
    const endpoint = process.env.DOC_INTEL_ENDPOINT;
    const key = process.env.DOC_INTEL_KEY;

    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );

    // Analyze the document using the "general-document" model
    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      docURL
    );

    // Wait for the analysis to complete
    const result = await poller.pollUntilDone();

    // Process key-value pairs
    const resultJSON = {};
    if (result.keyValuePairs && result.keyValuePairs.length > 0) {
      for (const { key, value } of result.keyValuePairs) {
        const formattedKey = key?.content?.replace(/\n/g, " ").trim() || "";
        const formattedValue = value?.content?.replace(/\n/g, " ").trim() || "";
        const isSelected = formattedValue === ":selected:";
        const isUnselected = formattedValue === ":unselected:";

        if (formattedKey) {
          resultJSON[formattedKey] = isSelected
            ? true
            : isUnselected
            ? false
            : formattedValue.replace(/^[:=:-]+|[:=:-]+$/g, "").trim();
        }
      }
    } else {
      console.log("No key-value pairs were extracted from the document.");
    }

    // console.log(
    //   "Formatted JSON Result / resultJSON :",
    //   JSON.stringify(resultJSON, null, 2)
    // );

    return resultJSON;
  } catch (error) {
    console.error("Error in analyzeDocumentWithAzure:", error);
    throw new Error("Azure OCR analysis failed");
  }
}

export const matchDocumentFields = (infoToMatch, resultJSON) => {
  // console.log("Checking input validity for matchDocumentFields...");
  if (!infoToMatch || typeof infoToMatch !== "object") {
    throw new Error("infoToMatch must be a valid object.");
  }
  if (!resultJSON || typeof resultJSON !== "object") {
    throw new Error("resultJSON must be a valid object.");
  }

  //console.log("Inputs are valid. Processing...");
  const convertToBaseForm = (str) => {
    if (typeof str === "number") str = str.toString();
    if (typeof str === "string") {
      return str
        .toLowerCase()
        .replace(/[^\w\s]/gi, "")
        .split(" ")
        .map((word) => {
          if (word === "address") {
            return word;
          }
          return word.replace(/(es|s)$/g, "");
        })
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return str;
  };

  const baseResultJSON = {};
  const baseInfoToMatch = {};

  //console.log("Converting resultJSON and infoToMatch to base form...");
  for (const [key, value] of Object.entries(resultJSON)) {
    baseResultJSON[convertToBaseForm(key)] = convertToBaseForm(value);
  }
  for (const [key, value] of Object.entries(infoToMatch)) {
    baseInfoToMatch[convertToBaseForm(key)] = convertToBaseForm(value);
  }

  //console.log("Base resultJSON:", baseResultJSON);
  //console.log("Base infoToMatch:", baseInfoToMatch);

  const compareResultJSON = {};
  const compareInfoToMatch = {};
  let allMatched = true;

  function hasMinimumSubstringMatch(str1, str2, minLength = 3) {
    for (let i = 0; i <= str1.length - minLength; i++) {
      const substring = str1.substring(i, i + minLength);
      if (str2.includes(substring)) {
        return true;
      }
    }
    return false;
  }

  // console.log("Starting comparison...");
  for (const [key, value] of Object.entries(baseInfoToMatch)) {
    let iterationMatch = false;
    let foundMatchedField = false;
    let keyLen = key.length;

    for (const [resKey, resValue] of Object.entries(baseResultJSON)) {
      // Match should occur at the word level, not character level
      // 1. Check if key of baseInfoToMatch matches any field in baseResultJSON
      let resKeyLen = resKey.length;
      let minLen = keyLen;
      if (
        (hasMinimumSubstringMatch(resKey, key, minLen) ||
          hasMinimumSubstringMatch(key, resKey, minLen)) &&
        foundMatchedField == false
      ) {
        iterationMatch = resValue === value;
        console.log(
          `Key match: "${key}": "${value}" (infoToMatch) compared with "${resKey}": "${resValue}" (resultJSON) - Match: ${iterationMatch}`
        );
        compareResultJSON[resKey] = resValue;
        compareInfoToMatch[key] = value;
        foundMatchedField = true;
        break;
      } else {
        foundMatchedField = false;
      }
    }

    // 2. Check if value matches any field in resultJSON if no key match
    if (foundMatchedField == false) {
      for (const [resKey, resValue] of Object.entries(baseResultJSON)) {
        if (resKey === value) {
          if (resValue == true) {
            iterationMatch = true;
          } else {
            iterationMatch = false;
          }
          console.log(
            `Value match: "${key}" (infoToMatch) with value "${value}" compared with "${resKey}": "${resValue}" (resultJSON) - Match: ${iterationMatch}`
          );
          compareResultJSON[resKey] = resValue;
          compareInfoToMatch[key] = value;
          foundMatchedField = true;
          break;
        } else {
          foundMatchedField = false;
        }
      }
    }

    // 3. If no match, add key-value to compareInfoToMatch
    if (foundMatchedField == false) {
      console.log(
        `No match found for "${key}": "${value}" (infoToMatch) in resultJSON`
      );
      compareInfoToMatch[key] = value;
      foundMatchedField = true;
    }

    // 4. Update allMatched status
    if (!iterationMatch) allMatched = false;
  }

  // Extract and format the relevant fields
  const formatFields = (fields) => {
    let formattedString = "";
    let address = "";

    for (const [key, value] of Object.entries(fields)) {
      if (key.includes("address")) {
        address = `at ${value}`;
      } else {
        formattedString += `${value}-${key}, `;
      }
    }

    return `${formattedString.trim()} ${address}`.trim();
  };

  const infoToMatchFormatted = formatFields(compareInfoToMatch);
  const resultJSONFormatted = formatFields(compareResultJSON);

  //console.log("Comparison completed.");
  return {
    isAlert: !allMatched,
    AlertMessage: allMatched
      ? "All the fields and their data provided in the application match the info given in the valuation report."
      : `Application shows ${infoToMatchFormatted}, while the valuation report shows ${resultJSONFormatted}. Please review and resolve.`,
  };
};

//############################# For fileType

export async function analyzeDocTypeWithAzure(docURL) {
  try {
    const endpoint = process.env.DOC_INTEL_ENDPOINT;
    const key = process.env.DOC_INTEL_KEY;

    const client = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );

    const poller = await client.beginAnalyzeDocument(
      "prebuilt-document",
      docURL
    );

    // Wait for the analysis to complete
    const result = await poller.pollUntilDone();

    const { paragraphs } = result;

    let combinedInitial = "";

    // Process paragraphs
    if (paragraphs.length > 0) {
      for (const paragraph of paragraphs) {
        const paragraphContent = paragraph.content.toLowerCase(); // Make lowercase
        combinedInitial += paragraphContent + " "; // Add to combinedInitial string
      }
      //console.log("Combined Initial Content:", combinedInitial);
    } else {
      console.log("No paragraphs were extracted from the document.");
      return "Document type could not be determined.";
    }

    // Check for keywords in the combinedInitial string
    if (combinedInitial.includes("valuation report")) {
      return "Valuation Report";
    } else if (combinedInitial.includes("salary slip")) {
      return "Salary Slip";
    } else if (
      combinedInitial.includes("bank statement") ||
      (combinedInitial.includes("statement") &&
        combinedInitial.includes("account") &&
        combinedInitial.includes("balance"))
    ) {
      return "Bank Statement";
    } else if (
      combinedInitial.includes("pay slip") ||
      (combinedInitial.includes("tax") &&
        combinedInitial.includes("payment") &&
        combinedInitial.includes("pay"))
    ) {
      return "Pay Slip";
    } else {
      return "Ad hoc";
    }
  } catch (error) {
    console.error("Error in analyzeDocumentWithAzure:", error);
    throw new Error("Azure OCR analysis failed");
  }
}
