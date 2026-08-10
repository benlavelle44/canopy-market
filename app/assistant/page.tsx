import Image from 'next/image';
import { Suspense } from 'react';
import AssistantChat from './AssistantChat';

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 text-center">
        <Image
          src="/kief/kief-wave.png"
          alt="Kief, Canopy's AI budtender"
          width={140}
          height={170}
          className="mx-auto mb-2 drop-shadow-[0_0_20px_rgba(57,255,106,0.25)]"
          priority
        />
        <h1 className="text-3xl font-bold">Ask Kief</h1>
        <p className="mt-2 text-canopy-muted">
          Canopy's AI budtender. Describe how you want to feel or a symptom you're dealing with --
          Kief will match you to real strains, concentrates, or edibles and show where to get them.
        </p>
      </div>
      <Suspense fallback={null}>
        <AssistantChat />
      </Suspense>
    </div>
  );
}
