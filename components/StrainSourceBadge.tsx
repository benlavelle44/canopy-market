import { StrainSource, StrainVerificationStatus } from '@/lib/types';

export default function StrainSourceBadge({
  source,
  verificationStatus,
}: {
  source?: StrainSource;
  verificationStatus?: StrainVerificationStatus;
}) {
  if (!source || source === 'canopy_original') {
    return (
      <span className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-2.5 py-0.5 text-xs font-medium text-canopy-green">
        Canopy Original
      </span>
    );
  }

  if (verificationStatus === 'verified') {
    return (
      <span className="rounded-full border border-canopy-purple/40 bg-canopy-purple/10 px-2.5 py-0.5 text-xs font-medium text-canopy-purple">
        AI Verified · Community Find
      </span>
    );
  }

  return (
    <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-300">
      Community Find · Pending Review
    </span>
  );
}
