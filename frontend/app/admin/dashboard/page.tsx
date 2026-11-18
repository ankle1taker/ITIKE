import { Suspense } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminContent />
    </Suspense>
  );
}

function AdminSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md animate-pulse">
        <div className="h-10 w-64 mx-auto bg-slate-200 rounded" />
        <div className="h-4 w-48 mx-auto bg-slate-200 rounded" />
      </div>
    </div>
  );
}

async function AdminContent() {
  const user = await getServerSession();

  if (!user) {
    redirect("/login?from=/admin/dashboard");
  }

  if (user.role !== "PLATFORM_ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-3xl font-bold">Platform Admin</h1>
        <p className="text-slate-600">Welcome, {user.fullName}.</p>
        <p className="text-sm text-slate-500">
          The platform administration portal is coming in v1.1. For now, use
          the API directly or contact the development team.
        </p>
      </div>
    </div>
  );
}