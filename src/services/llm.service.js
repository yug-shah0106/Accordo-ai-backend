import axios from "axios";
import env from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Local LLM Service using Ollama
 * Connects to a locally running Ollama instance
 */
class LLMService {
  constructor() {
    this.baseURL = env.llm?.baseURL || "http://localhost:11434";
    this.model = env.llm?.model || "llama3.2"; // Default model, can be changed
    this.timeout = env.llm?.timeout || 60000; // 60 seconds timeout
  }

  /**
   * Check if Ollama is running and the model is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseURL}/api/tags`, {
        timeout: 5000,
      });
      const models = response.data.models || [];
      // Check if model exists (with or without tag suffix)
      // e.g., "llama3.2" matches "llama3.2:latest"
      const modelExists = models.some((m) => {
        const modelName = m.name.split(":")[0]; // Remove tag (e.g., ":latest")
        return modelName === this.model || m.name === this.model;
      });
      
      if (!modelExists) {
        logger.warn(
          `Model ${this.model} not found. Available models: ${models.map((m) => m.name).join(", ")}`
        );
        return { available: false, models: models.map((m) => m.name) };
      }
      
      return { available: true, model: this.model };
    } catch (error) {
      logger.error("Ollama health check failed:", error.message);
      return { available: false, error: error.message };
    }
  }

  /**
   * Generate a chat completion using Ollama
   * @param {Array} messages - Array of message objects with role and content
   * @param {Object} options - Additional options (temperature, max_tokens, etc.)
   * @returns {Promise<string>} - The generated response
   */
  async chatCompletion(messages, options = {}) {
    try {
      const payload = {
        model: this.model,
        messages: messages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.top_p || 0.9,
          ...options,
        },
      };

      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.message?.content) {
        return response.data.message.content;
      }

      throw new Error("Invalid response format from Ollama");
    } catch (error) {
      logger.error("LLM Service Error:", {
        message: error.message,
        response: error.response?.data,
      });
      
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to Ollama at ${this.baseURL}. Make sure Ollama is running.`
        );
      }
      
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Stream chat completion (for real-time responses)
   * @param {Array} messages - Array of message objects
   * @param {Function} onChunk - Callback function for each chunk
   * @param {Object} options - Additional options
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      const payload = {
        model: this.model,
        messages: messages,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          ...options,
        },
      };

      const response = await axios.post(
        `${this.baseURL}/api/chat`,
        payload,
        {
          timeout: this.timeout,
          responseType: "stream",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      let fullResponse = "";

      return new Promise((resolve, reject) => {
        response.data.on("data", (chunk) => {
          const lines = chunk.toString().split("\n").filter((line) => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                fullResponse += data.message.content;
                if (onChunk) {
                  onChunk(data.message.content);
                }
              }
              if (data.done) {
                resolve(fullResponse);
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        });

        response.data.on("end", () => {
          resolve(fullResponse);
        });

        response.data.on("error", (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error("LLM Stream Error:", error.message);
      throw new Error(`Failed to stream response: ${error.message}`);
    }
  }
}

export default new LLMService();

