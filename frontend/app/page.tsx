import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth/server-session";
import { postLoginRedirect } from "@/lib/config";
import Link from "next/link";

export default function HomePage() {
  return (
    <Suspense fallback={<LandingContent />}>
      <AuthedRedirect />
    </Suspense>
  );
}

async function AuthedRedirect() {
  const user = await getServerSession();

  if (user) {
    redirect(postLoginRedirect[user.role]);
  }

  return <LandingContent />;
}

function LandingContent() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
              Itike
            </h1>
            <p className="text-lg md:text-xl text-slate-600">
              Book your bus ticket across Rwanda in seconds.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 text-white px-8 py-3 text-base font-medium hover:bg-slate-800 transition-colors"
            >
              Search buses
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-900 px-8 py-3 text-base font-medium hover:bg-slate-100 transition-colors"
            >
              Log in
            </Link>
          </div>

          <p className="text-sm text-slate-500">
            New to Itike?{" "}
            <Link href="/register" className="text-blue-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}