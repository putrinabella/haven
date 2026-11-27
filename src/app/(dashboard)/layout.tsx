import { Suspense } from "react";
import { requirePageUser } from "@/server/auth";
import { IndicatorLoading } from "@/shared/components/IndicatorLoading";

// Authorization happens on the server for every request under this group.
// Do not rely on client-side checks or on hiding links.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await requirePageUser();
  return <>{children}</>;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<IndicatorLoading />}>
      <AuthGate>{children}</AuthGate>
    </Suspense>
  );
}
