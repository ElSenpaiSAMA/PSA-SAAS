"use client";

import { ErrorScreen } from "@/components/error-screen";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="min-h-dvh">
      <ErrorScreen error={error} retry={retry} />
    </main>
  );
}
