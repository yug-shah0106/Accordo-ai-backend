import models from '../../models/index.js';

export interface Offer {
  price?: number;
  deliveryDays?: number;
}

interface PreferenceWeights {
  price?: number;
  delivery?: number;
}

interface PreferenceConstraints {
  max_price?: number;
  max_days?: number;
}

const calculateUtility = (offer: Offer, preferences: any): number => {
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

const generateCounterOffer = (offer: Offer, rounds: any[], preferences: any): Offer => {
  // Simple strategy: Improve price by 5%
  const newPrice = (offer.price || 0) * 0.95;
  return { ...offer, price: newPrice };
};

export const strategyService = {
  getNextAction: async (negotiationId: number, currentOffer: Offer) => {
    const negotiation = await models.Negotiation.findByPk(negotiationId, {
      include: ['Rounds', 'Requisition'],
    });

    if (!negotiation) {
      throw new Error('Negotiation not found');
    }

    // 1. Evaluate Current Offer
    // Assuming Buyer is the one using the strategy engine to respond to Vendor
    // We need Buyer preferences
    const buyerPreferences = await models.Preference.findOne({
      where: { entityType: 'Company' }, // Simplified: Get first company preference found
    });

    if (!buyerPreferences) {
      return { action: 'manual_intervention', reason: 'No preferences found' };
    }

    // Calculate utility of the vendor's offer
    const score = calculateUtility(currentOffer, buyerPreferences);

    // 2. Rule-Based Logic
    const targetScore = 80; // Threshold for acceptance
    const minScore = 50; // Threshold for rejection

    if (score >= targetScore) {
      return { action: 'accept', offer: currentOffer };
    }

    if (score < minScore) {
      return { action: 'reject', reason: 'Score too low' };
    }

    // 3. Generate Counter Offer
    const counterOffer = generateCounterOffer(currentOffer, (negotiation as any).Rounds, buyerPreferences);

    return { action: 'counter', offer: counterOffer };
  },
};
