import { Suspense } from "react";
import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4 animate-pulse">
        <div className="h-10 w-56 mx-auto bg-slate-200 rounded" />
        <div className="h-4 w-72 mx-auto bg-slate-200 rounded" />
      </div>
    </div>
  );
}

async function SearchContent() {
  const user = await getServerSession();

  if (!user) {
    redirect("/login?from=/search");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Search buses</h1>
        <p className="text-slate-600">
          Coming in Stage 3. Logged in as{" "}
          <span className="font-semibold">{user.fullName}</span>.
        </p>
      </div>
    </div>
  );
}