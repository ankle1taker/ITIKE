import { getServerSession } from "@/lib/auth/server-session";
import { redirect } from "next/navigation";
import { CompanySidebar } from "@/components/shared/sidebar";
import { Topbar } from "@/components/shared/topbar";

export default async function CompanyLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerSession();
  if (!user) redirect("/login");
  if (user.role !== "COMPANY_ADMIN" && user.role !== "COMPANY_OPERATOR") redirect("/");

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <CompanySidebar />
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <Topbar user={user} />
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
