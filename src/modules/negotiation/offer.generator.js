import { strategyService } from "./strategy.service.js";

export const offerGenerator = {
    // Wrapper to generate offers based on strategy
    createOffer: async (negotiationId, context) => {
        // Context might contain "aggressive", "cooperative" flags
        // For now, delegate to strategy service
        // In future, this will use optimization libraries
        return strategyService.getNextAction(negotiationId, context.lastOffer);
    }
};
