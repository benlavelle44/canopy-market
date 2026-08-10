import { createAdminClient } from './supabaseAdmin';

const FREE_MONTHLY_CREDITS = 5;
const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export interface CreditCheck {
  allowed: boolean;
  unlimited: boolean;
  remainingFree: number;
  remainingPurchased: number;
}

// Checks whether a signed-in shopper can make one more Claude-powered AI
// budtender call right now, and if so, atomically-enough consumes it (see
// note below). Canopy+ members are unlimited -- that's the actual reason
// to upgrade, see /pricing. Everyone else gets 5 free chats/month
// (auto-resetting) then draws from any purchased credit packs
// (see app/api/stripe/credits-checkout/route.ts). Anonymous shoppers never
// reach this -- the assistant route only calls it when a user token is
// present, and uses the free heuristic matcher otherwise. That's the real
// cost cap: the one truly unbounded, unauthenticated path never touches
// the paid Claude API at all.
//
// Known limitation: the free-credit decrement below is read-then-write,
// not a single atomic statement (unlike the Stripe-purchase increment,
// which uses the increment_ai_credits() RPC specifically because real
// money is on the line there). Two simultaneous requests from the same
// user could in rare cases both read the same "1 credit left" and both
// get allowed. Fine for this app's traffic today; worth moving to an RPC
// if usage grows enough for that race to matter in practice.
export async function checkAndConsumeAiCredit(userId: string): Promise<CreditCheck> {
  const admin = createAdminClient();
  if (!admin) {
    // No service-role key configured -- fail open rather than break the
    // whole assistant for everyone because billing isn't wired up yet.
    return { allowed: true, unlimited: true, remainingFree: 0, remainingPurchased: 0 };
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('member_tier, ai_free_credits_remaining, ai_free_credits_reset_at, ai_purchased_credits')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    return { allowed: true, unlimited: true, remainingFree: 0, remainingPurchased: 0 };
  }

  if ((profile as any).member_tier === 'plus') {
    return { allowed: true, unlimited: true, remainingFree: 0, remainingPurchased: 0 };
  }

  let free = Number((profile as any).ai_free_credits_remaining ?? 0);
  const purchased = Number((profile as any).ai_purchased_credits ?? 0);
  const resetAt = new Date((profile as any).ai_free_credits_reset_at as string).getTime();

  if (Date.now() >= resetAt) {
    free = FREE_MONTHLY_CREDITS;
    await admin
      .from('profiles')
      .update({
        ai_free_credits_remaining: free,
        ai_free_credits_reset_at: new Date(Date.now() + RESET_INTERVAL_MS).toISOString(),
      })
      .eq('id', userId);
  }

  if (free > 0) {
    await admin.from('profiles').update({ ai_free_credits_remaining: free - 1 }).eq('id', userId);
    return { allowed: true, unlimited: false, remainingFree: free - 1, remainingPurchased: purchased };
  }
  if (purchased > 0) {
    await admin.from('profiles').update({ ai_purchased_credits: purchased - 1 }).eq('id', userId);
    return { allowed: true, unlimited: false, remainingFree: 0, remainingPurchased: purchased - 1 };
  }
  return { allowed: false, unlimited: false, remainingFree: 0, remainingPurchased: 0 };
}
