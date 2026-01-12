/**
 * LLM Service - Integration with Ollama for AI chat completions
 */

import axios from 'axios';
import env from '../config/logger.js';
import logger from '../config/logger.js';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

interface LLMHealthResponse {
  available: boolean;
  model: string;
  error?: string;
}

const LLM_BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434';
const LLM_MODEL = process.env.LLM_MODEL || 'llama3.2';

/**
 * Check if LLM service is available
 */
export async function checkHealth(): Promise<LLMHealthResponse> {
  try {
    const response = await axios.get(`${LLM_BASE_URL}/api/tags`, {
      timeout: 5000,
    });

    return {
      available: true,
      model: LLM_MODEL,
    };
  } catch (error) {
    logger.error('LLM health check failed:', error);
    return {
      available: false,
      model: LLM_MODEL,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a chat completion request to the LLM
 */
export async function chatCompletion(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<string> {
  try {
    const response = await axios.post(
      `${LLM_BASE_URL}/api/chat`,
      {
        model: options.model || LLM_MODEL,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 1.0,
          num_predict: options.maxTokens ?? 2048,
        },
      },
      {
        timeout: 60000,
      }
    );

    return response.data.message?.content || '';
  } catch (error) {
    logger.error('LLM chat completion failed:', error);
    throw new Error('Failed to get response from LLM');
  }
}

/**
 * Stream a chat completion request to the LLM
 */
export async function streamChatCompletion(
  messages: LLMMessage[],
  onChunk: (chunk: string) => void,
  options: LLMOptions = {}
): Promise<void> {
  try {
    const response = await axios.post(
      `${LLM_BASE_URL}/api/chat`,
      {
        model: options.model || LLM_MODEL,
        messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          top_p: options.topP ?? 1.0,
          num_predict: options.maxTokens ?? 2048,
        },
      },
      {
        responseType: 'stream',
        timeout: 120000,
      }
    );

    response.data.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            onChunk(data.message.content);
          }
        } catch (e) {
          // Ignore parse errors for incomplete chunks
        }
      }
    });

    return new Promise((resolve, reject) => {
      response.data.on('end', resolve);
      response.data.on('error', reject);
    });
  } catch (error) {
    logger.error('LLM stream completion failed:', error);
    throw new Error('Failed to stream response from LLM');
  }
}

export default {
  checkHealth,
  chatCompletion,
  streamChatCompletion,
};
