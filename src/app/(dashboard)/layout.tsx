
import { Suspense } from "react";
import { connection } from "next/server";
import { requirePageUser } from "@/server/auth";
import { IndicatorLoading } from "@/shared/components/IndicatorLoading";

// Authorization happens on the server for every request.
// Wait for an incoming request before accessing Neon Auth cookies.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await connection();
  await requirePageUser();

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<IndicatorLoading />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
