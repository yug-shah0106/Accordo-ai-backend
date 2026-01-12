import type { Offer } from "./types.js";

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

  const unit_price = priceMatch ? Number(priceMatch[1]) : null;

  // Match various term formats:
  // - "Net 30", "Net 60", "Net 90" (standard)
  // - "Net 30 days", "Net 60 days", "Net 90 days"
  // - "payment terms 30", "payment terms 60", "payment terms 90"
  // - "30 days", "60 days", "90 days" (standalone, map to closest standard)
  let payment_terms: ("Net 30" | "Net 60" | "Net 90") | null = null;
  let raw_terms_days: number | null = null;
  let non_standard_terms = false;
  
  // First try standard Net 30/60/90
  let termsMatch = t.match(/\bnet\s*(30|60|90)(?:\s*days?)?\b/i);
  if (termsMatch) {
    const days = Number(termsMatch[1]);
    raw_terms_days = days;
    payment_terms = `Net ${days}` as "Net 30" | "Net 60" | "Net 90";
  } else {
    // Try "Net X days" where X might not be standard
    termsMatch = t.match(/\bnet\s*(\d+)\s*days?\b/i);
    if (termsMatch) {
      const days = Number(termsMatch[1]);
      raw_terms_days = days;
      if (days === 30 || days === 60 || days === 90) {
        payment_terms = `Net ${days}` as "Net 30" | "Net 60" | "Net 90";
      } else {
        non_standard_terms = true;
      }
    } else {
      // Try "payment terms X"
      termsMatch = t.match(/\b(?:payment\s+)?terms?\s*(\d+)\s*(?:days?)?\b/i);
      if (termsMatch) {
        const days = Number(termsMatch[1]);
        raw_terms_days = days;
        if (days === 30 || days === 60 || days === 90) {
          payment_terms = `Net ${days}` as "Net 30" | "Net 60" | "Net 90";
        } else {
          non_standard_terms = true;
        }
      } else {
        // Try standalone "X days" (likely to be terms if reasonable)
        const dayMatch = t.match(/\b(\d+)\s*days?\b/i);
        if (dayMatch) {
          const days = Number(dayMatch[1]);
          if (days >= 15 && days <= 120) {
            raw_terms_days = days;
            if (days === 30 || days === 60 || days === 90) {
              payment_terms = `Net ${days}` as "Net 30" | "Net 60" | "Net 90";
            } else {
              non_standard_terms = true;
            }
          }
        }
      }
    }
  }

  // Return offer with meta information if we found terms
  return {
    unit_price,
    payment_terms,
    meta: raw_terms_days ? { raw_terms_days, non_standard_terms } : undefined
  };
}

