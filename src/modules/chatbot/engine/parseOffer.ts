import type { Offer } from "./types.js";
import { parseDeliveryDate, calculateDeliveryDays } from "./deliveryUtility.js";

/**
 * Parse delivery information from text
 * Returns delivery date, days from today, and source type
 */
function parseDeliveryFromText(text: string): {
  delivery_date: string | null;
  delivery_days: number | null;
  delivery_source: 'explicit_date' | 'relative_days' | 'timeframe' | undefined;
  raw_delivery_text: string | undefined;
} {
  const t = text.toLowerCase();

  // Pattern 1: Explicit dates - "by March 15", "delivery March 15th 2026", "deliver by 2026-03-15"
  const explicitDatePatterns = [
    /(?:deliver(?:y|ed)?|ship(?:ping)?|by|before|on)\s+(?:by\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)/i,
    /(\d{4}-\d{2}-\d{2})/,  // ISO format
    /(\d{1,2}\/\d{1,2}\/\d{2,4})/,  // MM/DD/YYYY
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?)/i,
  ];

  for (const pattern of explicitDatePatterns) {
    const match = text.match(pattern);
    if (match) {
      const parsedDate = parseDeliveryDate(match[1] || match[0]);
      if (parsedDate) {
        const days = calculateDeliveryDays(parsedDate);
        return {
          delivery_date: parsedDate.toISOString().split('T')[0],
          delivery_days: days,
          delivery_source: 'explicit_date',
          raw_delivery_text: match[0]
        };
      }
    }
  }

  // Pattern 2: Relative days - "within 30 days", "in 2 weeks", "15 day delivery"
  const relativeDaysPatterns = [
    /(?:within|in|next)\s+(\d+)\s*(?:days?|business\s+days?)/i,
    /(\d+)\s*(?:days?|weeks?)\s*(?:delivery|shipping|lead\s*time)/i,
    /(?:delivery|shipping|lead\s*time)\s*(?:in|of)?\s*(\d+)\s*(?:days?|weeks?)/i,
  ];

  for (const pattern of relativeDaysPatterns) {
    const match = text.match(pattern);
    if (match) {
      let days = parseInt(match[1], 10);
      // Check if it's weeks
      if (/weeks?/i.test(match[0])) {
        days *= 7;
      }

      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + days);

      return {
        delivery_date: deliveryDate.toISOString().split('T')[0],
        delivery_days: days,
        delivery_source: 'relative_days',
        raw_delivery_text: match[0]
      };
    }
  }

  // Pattern 3: Timeframes - "early March", "mid February", "end of March"
  const timeframePattern = /(?:early|mid|late|end\s+of)\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i;
  const timeframeMatch = text.match(timeframePattern);
  if (timeframeMatch) {
    const parsedDate = parseDeliveryDate(timeframeMatch[0]);
    if (parsedDate) {
      const days = calculateDeliveryDays(parsedDate);
      return {
        delivery_date: parsedDate.toISOString().split('T')[0],
        delivery_days: days,
        delivery_source: 'timeframe',
        raw_delivery_text: timeframeMatch[0]
      };
    }
  }

  return {
    delivery_date: null,
    delivery_days: null,
    delivery_source: undefined,
    raw_delivery_text: undefined
  };
}

export function parseOfferRegex(text: string): Offer {
  // Remove commas for easier parsing (e.g., "$1,200" -> "$1200")
  const t = text.replace(/,/g, "").trim();

  // Try multiple price patterns (order matters - most specific first)
  let priceMatch = null;
  
  // Pattern 1: Currency symbols with number (e.g., "$95", "USD 95", "₹95", "95$")
  priceMatch = t.match(/(?:₹|rs\.?|inr|usd|\$)\s*([0-9]+(?:\.[0-9]+)?)/i) ?? 
                t.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:₹|rs\.?|inr|usd|\$)/i);
  
  // Pattern 2: "X per unit" or "X/unit"
  if (!priceMatch) {
    priceMatch = t.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:per\s+unit|\/unit)/i);
  }
  
  // Pattern 3: "X Net Y" format (e.g., "93 Net 60" -> 93 is price, 60 is terms)
  let matchedViaXNetY = false;
  if (!priceMatch) {
    const netPatternMatch = t.match(/\b([0-9]{2,5})(?:\.[0-9]+)?\s+net\s+(30|60|90)(?:\s*days?)?\b/i);
    if (netPatternMatch) {
      priceMatch = netPatternMatch; // The first capture group is the price
      matchedViaXNetY = true; // Mark that we matched via this pattern
    }
  }
  
  // Pattern 4: Standalone numbers ONLY if there's an explicit price cue
  if (!priceMatch) {
    const hasPriceCue = /(\$|₹|inr|usd|rs\.?|price|unit\s*price|rate|per\s+unit|\/unit)/i.test(t);
    if (hasPriceCue) {
      priceMatch = t.match(/\b([0-9]{2,5})(?:\.[0-9]+)?\b/);
    }
  }

  // Extra safety: if matched number is 30/60/90 and text contains "net/terms/days", treat as terms, not price
  // This prevents "Net 60" from being parsed as price=60
  // BUT skip this check if we matched via "X Net Y" pattern (Pattern 3) where X is clearly the price
  if (priceMatch && !matchedViaXNetY) {
    const n = Number(priceMatch[1]);
    const looksLikeTerms = (n === 30 || n === 60 || n === 90) && /net|terms|days/i.test(t);
    // Only nullify if there's no currency symbol and the number appears to be terms
    if (looksLikeTerms && !/(\$|₹|inr|usd|rs\.?)/i.test(t)) {
      priceMatch = null;
    }
  }

  // UPDATED Feb 2026: Changed from unit_price to total_price
  const total_price = priceMatch ? Number(priceMatch[1]) : null;

  // Match various term formats:
  // UPDATED January 2026: Now accepts ANY "Net X" format (X = 1-120 days)
  // - "Net 30", "Net 45", "Net 60", "Net 90" (any number)
  // - "Net 30 days", "Net 45 days", etc.
  // - "payment terms 45", "terms 30", etc.
  // - Standalone "X days" where X is reasonable (15-120)
  let payment_terms: string | null = null;
  let payment_terms_days: number | null = null;
  let raw_terms_days: number | null = null;
  let non_standard_terms = false;

  // Pattern 1: "Net X" or "Net X days" - accept ANY number (1-120)
  let termsMatch = t.match(/\bnet\s*(\d+)(?:\s*days?)?\b/i);
  if (termsMatch) {
    const days = Number(termsMatch[1]);
    if (days >= 1 && days <= 120) {
      raw_terms_days = days;
      payment_terms_days = days;
      payment_terms = `Net ${days}`;
      non_standard_terms = days !== 30 && days !== 60 && days !== 90;
    }
  }

  // Pattern 2: "payment terms X" or "terms X"
  if (!payment_terms) {
    termsMatch = t.match(/\b(?:payment\s+)?terms?\s*(\d+)\s*(?:days?)?\b/i);
    if (termsMatch) {
      const days = Number(termsMatch[1]);
      if (days >= 1 && days <= 120) {
        raw_terms_days = days;
        payment_terms_days = days;
        payment_terms = `Net ${days}`;
        non_standard_terms = days !== 30 && days !== 60 && days !== 90;
      }
    }
  }

  // Pattern 3: Standalone "X days" or "X-day" (likely to be terms if reasonable)
  // But NOT if it looks like delivery days (e.g., "30-day delivery")
  if (!payment_terms) {
    // Match "X days" or "X-day" but exclude delivery context
    const dayMatch = t.match(/\b(\d+)\s*-?\s*days?\b(?!\s*(?:delivery|shipping|lead))/i);
    if (dayMatch) {
      const days = Number(dayMatch[1]);
      if (days >= 15 && days <= 120) {
        raw_terms_days = days;
        payment_terms_days = days;
        payment_terms = `Net ${days}`;
        non_standard_terms = days !== 30 && days !== 60 && days !== 90;
      }
    }
  }

  // Parse delivery information
  const delivery = parseDeliveryFromText(text);

  // Build meta object
  const meta: {
    raw_terms_days?: number;
    non_standard_terms?: boolean;
    delivery_source?: 'explicit_date' | 'relative_days' | 'timeframe';
    raw_delivery_text?: string;
  } = {};

  if (raw_terms_days !== null) {
    meta.raw_terms_days = raw_terms_days;
    meta.non_standard_terms = non_standard_terms;
  }

  if (delivery.delivery_source) {
    meta.delivery_source = delivery.delivery_source;
  }

  if (delivery.raw_delivery_text) {
    meta.raw_delivery_text = delivery.raw_delivery_text;
  }

  // Return offer with delivery and meta information
  // UPDATED Feb 2026: Changed from unit_price to total_price
  return {
    total_price,
    payment_terms,
    payment_terms_days,
    delivery_date: delivery.delivery_date,
    delivery_days: delivery.delivery_days,
    meta: Object.keys(meta).length > 0 ? meta : undefined
  };
}

/**
 * Enhanced parseOffer that includes delivery parsing
 * Alias for parseOfferRegex with full delivery support
 */
export function parseOfferWithDelivery(text: string): Offer {
  return parseOfferRegex(text);
}

