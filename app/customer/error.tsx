"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="flyer mx-auto mt-12 max-w-md space-y-4 p-6 text-center">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-xl">Customer view failed to load</h2>
      <p className="text-sm text-muted">{error.message}</p>
      <button className="btn btn-neel" onClick={reset}>Try again</button>
    </div>
  );
}
