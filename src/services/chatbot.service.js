import axios from "axios";
import env from "../config/env.js";
import logger from "../config/logger.js";
import CustomError from "../utils/custom-error.js";

/**
 * Chatbot Service
 * Handles integration with the Accordo Chatbot API
 */

/**
 * Create a deal in the chatbot system
 * @param {string} vendorName - Name of the vendor (counterparty)
 * @param {string} projectName - Name of the project
 * @param {string} requisitionTitle - Title of the requisition
 * @returns {Promise<string>} - The created deal ID
 * @throws {CustomError} - If deal creation fails
 */
export const createDeal = async (vendorName, projectName, requisitionTitle) => {
  const chatbotApiUrl = env.chatbotApiUrl;

  if (!chatbotApiUrl) {
    throw new CustomError("Chatbot API URL not configured. Please set CHATBOT_API_URL in environment.", 500);
  }

  const dealTitle = `${projectName} - ${requisitionTitle}`;

  try {
    logger.info(`Creating chatbot deal: "${dealTitle}" for vendor: ${vendorName}`);

    const response = await axios.post(
      `${chatbotApiUrl}/deals`,
      {
        title: dealTitle,
        counterparty: vendorName,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    if (!response.data?.id) {
      throw new Error("Invalid response from chatbot API - no deal ID returned");
    }

    const dealId = response.data.id;
    logger.info(`Chatbot deal created successfully with ID: ${dealId}`);

    return dealId;
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      logger.error(`Cannot connect to chatbot API at ${chatbotApiUrl}`);
      throw new CustomError(
        `Cannot connect to chatbot service at ${chatbotApiUrl}. Please ensure the chatbot backend is running.`,
        503
      );
    }

    if (error.response) {
      logger.error(`Chatbot API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      throw new CustomError(
        `Chatbot service error: ${error.response.data?.message || error.response.statusText}`,
        error.response.status
      );
    }

    logger.error(`Failed to create chatbot deal: ${error.message}`);
    throw new CustomError(`Failed to create deal in chatbot system: ${error.message}`, 500);
  }
};

/**
 * Check if chatbot service is available
 * @returns {Promise<boolean>} - True if service is available
 */
export const checkChatbotHealth = async () => {
  const chatbotApiUrl = env.chatbotApiUrl;

  if (!chatbotApiUrl) {
    return false;
  }

  try {
    await axios.get(`${chatbotApiUrl}/deals`, { timeout: 5000 });
    return true;
  } catch (error) {
    logger.warn(`Chatbot service health check failed: ${error.message}`);
    return false;
  }
};

export default {
  createDeal,
  checkChatbotHealth,
};
