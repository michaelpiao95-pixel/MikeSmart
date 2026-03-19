"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html>
      <body style={{ background: "#0a0a0f", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", color: "#fff", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>Something went wrong</h2>
          <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "1.5rem" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ background: "#4f46e5", color: "#fff", border: "none", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
