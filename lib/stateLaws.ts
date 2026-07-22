// General legal-status snapshot, current as of July 2026. Cannabis law is
// moving fast right now (a DEA rescheduling decision is pending as of this
// writing) -- treat this as a starting point, not legal advice, and verify
// with the linked state agency before making business decisions.
export type LawStatus = 'recreational' | 'medical' | 'cbd-only' | 'illegal';

export interface StateLaw {
  code: string;
  name: string;
  status: LawStatus;
  note?: string;
}

const RECREATIONAL = new Set([
  'AK','AZ','CA','CO','CT','DE','IL','ME','MD','MA','MI','MN','MO','MT',
  'NV','NJ','NM','NY','OH','OR','RI','VT','VA','WA',
]);

const ILLEGAL = new Set(['ID', 'KS', 'SC', 'WY']);

const CBD_ONLY = new Set(['GA', 'IN', 'IA', 'TN', 'TX', 'WI']);

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

export const STATE_LAWS: StateLaw[] = Object.entries(STATE_NAMES).map(([code, name]) => {
  let status: LawStatus = 'medical';
  if (RECREATIONAL.has(code)) status = 'recreational';
  else if (ILLEGAL.has(code)) status = 'illegal';
  else if (CBD_ONLY.has(code)) status = 'cbd-only';
  return { code, name, status };
});

export const STATUS_LABEL: Record<LawStatus, string> = {
  recreational: 'Recreational + Medical',
  medical: 'Medical Only',
  'cbd-only': 'Low-THC CBD Only',
  illegal: 'Fully Illegal',
};

export const STATUS_COLOR: Record<LawStatus, string> = {
  recreational: 'text-canopy-green border-canopy-green/40 bg-canopy-green/10',
  medical: 'text-canopy-gold border-canopy-gold/40 bg-canopy-gold/10',
  'cbd-only': 'text-canopy-purple border-canopy-purple/40 bg-canopy-purple/10',
  illegal: 'text-red-400 border-red-400/40 bg-red-400/10',
};
