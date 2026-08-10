import { cookies } from 'next/headers';

export const STATE_COOKIE = 'canopy_state';

// Kept in sync with whichever states actually have approved dispensaries.
// The gate/picker only offers these -- update here (and in
// components/StateGate.tsx, which duplicates the list for the client
// bundle) as new states go live.
export const SUPPORTED_STATES = ['AZ', 'CA', 'CO', 'IL', 'MI', 'MT', 'NY'];

// Cannabis can't legally cross state lines, so every state-scoped page
// (home, /shop, /dispensaries, strain "Available at", the AI budtender)
// needs to know which state a shopper is in before it queries dispensaries
// or products. That state lives in this cookie, set once via the StateGate
// picker in the root layout (components/StateGate.tsx) or silently from
// profiles.state for a signed-in shopper who already has one saved.
// Server Components and Route Handlers call this; Client Components read
// the same cookie directly via document.cookie since it's not httpOnly.
export async function getShopperState(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(STATE_COOKIE)?.value;
  return value && SUPPORTED_STATES.includes(value) ? value : null;
}
