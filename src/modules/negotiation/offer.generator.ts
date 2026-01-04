import { strategyService, type Offer } from './strategy.service.js';

interface OfferContext {
  lastOffer: any;
}

interface ActionResponse {
  action: string;
  offer?: Offer;
  reason?: string;
}

export const offerGenerator = {
  // Wrapper to generate offers based on strategy
  createOffer: async (negotiationId: number, context: OfferContext): Promise<ActionResponse> => {
    // Context might contain "aggressive", "cooperative" flags
    // For now, delegate to strategy service
    // In future, this will use optimization libraries
    return strategyService.getNextAction(negotiationId, context.lastOffer);
  },
};
