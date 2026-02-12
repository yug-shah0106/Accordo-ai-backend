import { Router } from 'express';
import {
  submitQuote,
  checkCanEditQuote,
  editQuote,
  getDeal,
  enterChat,
  sendMessage,
  getPMResponse,
  getSuggestions,
} from './vendor-chat.controller.js';

/**
 * Vendor Chat Routes
 * ALL routes are PUBLIC - NO authMiddleware
 * Authentication is via uniqueToken in request body/query
 */
const vendorChatRouter = Router();

// Quote management
vendorChatRouter.post('/quote', submitQuote);
vendorChatRouter.get('/can-edit-quote', checkCanEditQuote);
vendorChatRouter.put('/quote', editQuote);

// Deal/chat access
vendorChatRouter.get('/deal', getDeal);
vendorChatRouter.post('/enter', enterChat);

// Messaging (two-phase pattern)
vendorChatRouter.post('/message', sendMessage);
vendorChatRouter.post('/pm-response', getPMResponse);

// Vendor suggestions (after PM counter-offer)
vendorChatRouter.post('/suggestions', getSuggestions);

export default vendorChatRouter;
