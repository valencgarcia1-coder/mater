export default function CameraGrid({ connected }: { connected: boolean }) {
  return (
    <div>
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-white/40">
        Cameras
      </h3>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-white/70">Camera 01</span>
            <span className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
              <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-white/20"}`} />
              {connected ? "Live" : "Off"}
            </span>
          </div>
          <div className="aspect-video rounded-lg bg-black" />
        </div>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/10 text-white/20 sm:aspect-auto"
          >
            <span className="text-xl leading-none">+</span>
            <span className="font-mono text-[10px] uppercase tracking-wider">Add camera</span>
          </div>
        ))}
      </div>
    </div>
  );
}
