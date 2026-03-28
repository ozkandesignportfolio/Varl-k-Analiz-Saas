export function AnimatedBackground() {
  return (
    <div aria-hidden className="landing-v2-ambient-bg fixed inset-0 pointer-events-none z-0">
      <div className="landing-v2-ambient-layer landing-v2-ambient-layer-a" />
      <div className="landing-v2-ambient-layer landing-v2-ambient-layer-b" />
      <div className="landing-v2-ambient-layer landing-v2-ambient-layer-c" />
    </div>
  );
}
