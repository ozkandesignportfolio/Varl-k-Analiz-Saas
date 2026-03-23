export const metadata = {
  title: "Safari Check | Assetly",
};

export default function SafariCheckPage() {
  return (
    <main className="min-h-screen min-h-[100svh] bg-white px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-slate-50 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Safari Check</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Temel public route testi</h1>
        <p className="mt-4 text-base leading-7 text-slate-700">
          Bu sayfa bilerek sade tutuldu. Ağır client mantığı, observer, service worker kaydı, chart ve gelişmiş
          efektler içermez.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Route</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">/safari-check</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-medium text-slate-500">Beklenen</p>
            <p className="mt-2 text-lg font-semibold text-slate-950">Düz HTML/CSS ile anında açılmalı</p>
          </div>
        </div>
      </div>
    </main>
  );
}
