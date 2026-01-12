import { z } from "zod";

export const OfferSchema = z.object({
  unit_price: z.number().nullable(),
  payment_terms: z.enum(["Net 30", "Net 60", "Net 90"]).nullable(),
  meta: z.object({
    raw_terms_days: z.number().optional(),
    non_standard_terms: z.boolean().optional(),
  }).optional(),
});
export type Offer = z.infer<typeof OfferSchema>;

export const DecisionSchema = z.object({
  action: z.enum(["ACCEPT", "COUNTER", "WALK_AWAY", "ESCALATE", "ASK_CLARIFY"]),
  utilityScore: z.number(),
  counterOffer: OfferSchema.nullable(),
  reasons: z.array(z.string()),
});
export type Decision = z.infer<typeof DecisionSchema>;

export type Explainability = {
  vendorOffer: { unit_price: number | null; payment_terms: string | null };
  utilities: {
    priceUtility: number | null;
    termsUtility: number | null;
    weightedPrice: number | null;
    weightedTerms: number | null;
    total: number | null;
  };
  decision: {
    action: string;
    reasons: string[];
    counterOffer?: { unit_price: number | null; payment_terms: string | null } | null;
  };
  configSnapshot: {
    weights: { price: number; terms: number };
    thresholds: { accept: number; walkaway: number };
    unitPrice: { anchor: number; target: number; max: number; step: number };
    termOptions: string[];
  };
};

