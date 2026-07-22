export default function TrippyBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-canopy-bg" />
      <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-canopy-green/25 blur-[110px] animate-blobfloat" />
      <div className="absolute top-1/3 -right-32 h-[26rem] w-[26rem] rounded-full bg-canopy-purple/25 blur-[110px] animate-blobfloatslow" />
      <div className="absolute bottom-0 left-1/4 h-[22rem] w-[22rem] rounded-full bg-canopy-pink/20 blur-[100px] animate-blobfloat" />
      <div className="absolute bottom-1/4 right-1/4 h-[18rem] w-[18rem] rounded-full bg-canopy-lime/15 blur-[90px] animate-blobfloatslow" />
      <div className="absolute inset-0 opacity-[0.04] text-8xl leading-none select-none flex flex-wrap gap-8 p-8 rotate-6">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i}>🌿</span>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-canopy-bg/80" />
    </div>
  );
}
