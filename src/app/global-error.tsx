"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ padding: 24, textAlign: "center" }}>
          <h1>Something went wrong</h1>
          <button onClick={reset}>Try again</button>
        </main>
      </body>
    </html>
  );
}
