import { Suspense } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

/**
 * Company dashboard page.
 *
 * Split into:
 * - DashboardSkeleton (fallback while session resolves)
 * - DashboardContent (async, reads session, redirects or renders)
 *
 * Suspense wrapper prevents Next.js 16 prerender warnings and gives
 * instant first-paint while the session validates.
 */
export default function CompanyDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md animate-pulse">
        <div className="h-10 w-64 mx-auto bg-slate-200 rounded" />
        <div className="h-4 w-48 mx-auto bg-slate-200 rounded" />
        <div className="h-4 w-40 mx-auto bg-slate-200 rounded" />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const user = await getServerSession();

  if (!user) {
    redirect("/login?from=/company/dashboard");
  }

  if (user.role !== "COMPANY_ADMIN" && user.role !== "COMPANY_OPERATOR") {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-3xl font-bold">Company Dashboard</h1>
        <p className="text-slate-600">Welcome, {user.fullName}.</p>
        <p className="text-sm text-slate-500">
          Company operations portal — coming in Stage 2e.
        </p>
        <p className="text-xs text-slate-400">
          Role: {user.role} · Company: {user.companyId?.slice(0, 8)}...
        </p>
      </div>
    </div>
  );
}