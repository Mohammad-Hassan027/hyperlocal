"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-wall p-4 font-body">
        <div className="flyer space-y-4 p-8 text-center max-w-sm w-full">
          <p className="text-5xl">⚠️</p>
          <h1 className="text-2xl">Something went wrong</h1>
          <p className="text-sm text-muted">{error.message || "An unexpected error occurred."}</p>
          {error.digest && (
            <p className="font-mono text-xs text-muted">ID: {error.digest}</p>
          )}
          <button className="btn btn-neel w-full" onClick={reset}>
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
