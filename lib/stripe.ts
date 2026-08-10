import Stripe from 'stripe';

// Returns null if billing hasn't been configured yet -- callers should
// handle that gracefully rather than throwing, since this app should work
// fully (minus paid upgrades) before Stripe keys are added.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' });
}

export const TIER_PRICE_ENV: Record<'pro' | 'verified', string> = {
  pro: 'STRIPE_PRICE_PRO',
  verified: 'STRIPE_PRICE_VERIFIED',
};

// Consumer "Canopy+" membership -- separate price/product from dispensary
// billing above. $5/mo: unlimited saved favorites & AI history, verified
// reviewer badge, leaderboard eligibility, personalized recommendations,
// and unlimited AI budtender chats (see lib/aiCredits.ts).
export const MEMBER_PRICE_ENV = 'STRIPE_PRICE_MEMBER';

// One-time AI budtender credit packs -- for Free-tier shoppers who use up
// their 5 free Claude-powered chats/month and want more without
// subscribing to Canopy+. Each Price in Stripe should be a one-time
// (not recurring) charge.
export const CREDIT_PACK_PRICE_ENV: Record<'5' | '15', string> = {
  '5': 'STRIPE_PRICE_CREDITS_5',
  '15': 'STRIPE_PRICE_CREDITS_15',
};

export const CREDIT_PACKS: Record<'5' | '15', { credits: number; label: string; price: string }> = {
  '5': { credits: 5, label: '5 AI chats', price: '$2.99' },
  '15': { credits: 15, label: '15 AI chats', price: '$6.99' },
};
