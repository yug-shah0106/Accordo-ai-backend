import models from "../../models/index.js";
import { negotiationService } from "./negotiation.service.js"; // Import to use utility calc

export const strategyService = {
    getNextAction: async (negotiationId, currentOffer) => {
        const negotiation = await models.Negotiation.findByPk(negotiationId, {
            include: ["Rounds", "Requisition"],
        });

        if (!negotiation) {
            throw new Error("Negotiation not found");
        }

        // 1. Evaluate Current Offer
        // Assuming Buyer is the one using the strategy engine to respond to Vendor
        // We need Buyer preferences
        const buyerPreferences = await models.Preference.findOne({
            where: { entityType: "Company" }, // Simplified: Get first company preference found
        });

        if (!buyerPreferences) {
            return { action: "manual_intervention", reason: "No preferences found" };
        }

        // Calculate utility of the vendor's offer
        // We need to adapt calculateUtility to handle the offer structure
        // For now, let's assume a simple structure
        const score = calculateUtility(currentOffer, buyerPreferences);

        // 2. Rule-Based Logic
        const targetScore = 80; // Threshold for acceptance
        const minScore = 50; // Threshold for rejection

        if (score >= targetScore) {
            return { action: "accept", offer: currentOffer };
        }

        if (score < minScore) {
            return { action: "reject", reason: "Score too low" };
        }

        // 3. Generate Counter Offer
        // Strategy: Trade-off. If price is high, ask for faster delivery?
        // Or simply split the difference (Linear concession)

        const counterOffer = generateCounterOffer(currentOffer, negotiation.Rounds, buyerPreferences);

        return { action: "counter", offer: counterOffer };
    },
};

// Helper functions (Internal)
const calculateUtility = (offer, preferences) => {
    let score = 0;
    const { weights } = preferences;

    if (offer.price && weights.price) {
        // Simplified normalization
        const maxPrice = preferences.constraints?.max_price || 1000;
        const normalizedPrice = Math.max(0, (maxPrice - offer.price) / maxPrice);
        score += weights.price * normalizedPrice * 100;
    }

    // ... other factors

    return score; // 0-100
};

const generateCounterOffer = (offer, rounds, preferences) => {
    // Simple strategy: Improve price by 5%
    const newPrice = offer.price * 0.95;
    return { ...offer, price: newPrice };
};
