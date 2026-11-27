"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Never render error.message: in production it is redacted, and in dev it may leak internals.
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      {error.digest && <p className="text-sm opacity-60">Reference: {error.digest}</p>}
      <button onClick={reset} className="rounded bg-black px-4 py-2 text-white">
        Try again
      </button>
    </main>
  );
}
