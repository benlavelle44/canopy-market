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
// reviewer badge, leaderboard eligibility, personalized recommendations.
export const MEMBER_PRICE_ENV = 'STRIPE_PRICE_MEMBER';
