export default function Footer() {
  return (
    <footer className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-4 border-t border-neutral-900 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-left">
      <div className="flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-black text-[10px] font-bold">
          M
        </div>
        <span className="text-sm text-neutral-500">Mater</span>
      </div>
      <p className="text-xs text-neutral-600">
        Private-property vehicle detection. Built and still being proven out.
      </p>
    </footer>
  );
}
