"use client";

import { useEffect } from "react";

export default function DashboardError({
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
    <div className="flex flex-col items-center justify-center h-[60vh] p-6">
      <div className="max-w-md w-full bg-surface-2 border border-border rounded-xl p-6 text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-red-950/40 border border-red-900/40 flex items-center justify-center mx-auto">
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Page error</h2>
          <p className="text-sm text-muted-foreground mt-1 font-mono">{error.message}</p>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={reset}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
          >
            Try again
          </button>
          <a
            href="/"
            className="bg-surface-3 hover:bg-surface-4 border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg transition-all"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
