import models from '../../models/index.js';
import { CustomError } from '../../utils/custom-error.js';
import type { Negotiation } from '../../models/negotiation.js';
import type { Preference } from '../../models/preference.js';

interface Offer {
  price?: number;
  deliveryDays?: number;
  productId?: number;
  Price?: number;
}

interface PreferenceWeights {
  price?: number;
  delivery?: number;
}

interface PreferenceConstraints {
  max_price?: number;
  max_days?: number;
}

interface PreferenceData {
  weights: PreferenceWeights;
  constraints?: PreferenceConstraints;
}

const calculateUtility = (offer: Offer, preferences: any): number => {
  let score = 0;
  const { weights } = preferences;

  // Simple linear utility model: Sum(weight * normalized_value)
  // For price, lower is better. For qty, higher is usually better (up to a limit).
  // This is a simplified version. Real world needs normalization functions.

  if (offer.price && weights.price) {
    // Assuming max_price constraint exists to normalize
    const maxPrice = preferences.constraints?.max_price || offer.price * 1.2;
    const normalizedPrice = Math.max(0, (maxPrice - offer.price) / maxPrice);
    score += weights.price * normalizedPrice;
  }

  if (offer.deliveryDays && weights.delivery) {
    const maxDays = preferences.constraints?.max_days || 30;
    const normalizedDelivery = Math.max(0, (maxDays - offer.deliveryDays) / maxDays);
    score += weights.delivery * normalizedDelivery;
  }

  // Add more factors as needed
  return score;
};

export const negotiationService = {
  createNegotiation: async (data: any): Promise<Negotiation> => {
    return models.Negotiation.create(data);
  },

  getNegotiation: async (id: number): Promise<Negotiation | null> => {
    return models.Negotiation.findByPk(id, {
      include: ['Rounds', 'Requisition', 'Vendor'],
    });
  },

  savePreferences: async (data: any): Promise<Preference> => {
    // Check if preference exists for context
    const existing = await models.Preference.findOne({
      where: {
        entityId: data.entityId,
        entityType: data.entityType,
        context: data.context || 'global',
      },
    });

    if (existing) {
      return existing.update(data);
    }
    return models.Preference.create(data);
  },

  calculateBATNA: async (rfqId: number, userId: number): Promise<{ batnaScore: number }> => {
    // 1. Get user preferences
    const preferences = await models.Preference.findOne({
      where: { entityId: userId, entityType: 'Company' }, // Assuming Buyer is Company
    });

    if (!preferences) {
      throw new CustomError('Preferences not defined for BATNA calculation', 400);
    }

    // 2. Get alternative offers (e.g., from other vendors for same RFQ or market data)
    // For MVP, we might simulate or fetch from a 'MarketBenchmark' table (not created yet)
    // Here we'll just return a placeholder or calculate based on existing active negotiations
    const otherNegotiations = await models.Negotiation.findAll({
      where: { rfqId, status: 'active' },
      include: ['Rounds'],
    });

    let bestScore = 0;

    for (const neg of otherNegotiations) {
      const lastRound = (neg as any).Rounds[(neg as any).Rounds.length - 1];
      if (lastRound) {
        const score = calculateUtility(lastRound.offerDetails, preferences);
        if (score > bestScore) bestScore = score;
      }
    }

    return { batnaScore: bestScore };
  },

  generateMESO: async (negotiationId: number) => {
    const negotiation = await models.Negotiation.findByPk(negotiationId);
    if (!negotiation) throw new CustomError('Negotiation not found', 404);

    // Logic to generate equivalent offers
    // This requires knowing the Counterparty's preferences (estimated)
    // For MVP, we will generate 3 variations:
    // 1. Balanced
    // 2. Price Focused (Lower price, slower delivery)
    // 3. Speed Focused (Higher price, faster delivery)

    const basePrice = 100; // Placeholder - should come from RFQ/Last Offer
    const baseDelivery = 10;

    const mesoOffers = [
      { type: 'balanced', price: basePrice, deliveryDays: baseDelivery },
      { type: 'price_focused', price: basePrice * 0.9, deliveryDays: baseDelivery + 5 },
      { type: 'speed_focused', price: basePrice * 1.1, deliveryDays: baseDelivery - 3 },
    ];

    return mesoOffers;
  },
};
