import { Suspense } from 'react';
import AssistantChat from './AssistantChat';

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">AI Budtender</h1>
        <p className="mt-2 text-canopy-muted">
          Describe how you want to feel or a symptom you're dealing with. I'll match you to real
          strains and show where to get them.
        </p>
      </div>
      <Suspense fallback={null}>
        <AssistantChat />
      </Suspense>
    </div>
  );
}
