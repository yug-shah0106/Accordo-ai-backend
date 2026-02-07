/**
 * Vendor Chat Module
 * Public endpoints for vendor quote submission and chat negotiation
 * No authentication required - uses uniqueToken for access control
 */

export { default as vendorChatRoutes } from './vendor-chat.routes.js';
export { default as vendorChatController } from './vendor-chat.controller.js';
export { default as vendorChatService } from './vendor-chat.service.js';
export { default as vendorChatValidator } from './vendor-chat.validator.js';

export * from './vendor-chat.service.js';
export * from './vendor-chat.validator.js';
