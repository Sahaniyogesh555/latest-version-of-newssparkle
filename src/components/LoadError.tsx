export function LoadError({ onRetry, message = "We could not load these stories. Please try again in a moment." }: { onRetry: () => void; message?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-border bg-card px-5 py-10 text-center">
      <h2 className="font-serif text-2xl font-bold text-headline">Stories unavailable</h2>
      <p className="mt-3 text-sm text-byline">{message}</p>
      <button type="button" onClick={onRetry} className="btn-primary mt-5">Retry</button>
    </div>
  );
}
