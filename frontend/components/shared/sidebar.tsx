"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, MapPin, Bus, CalendarDays, ClipboardList,
  Users, UserCircle, Settings, LogOut
} from "lucide-react";

const sidebarItems = [
  { name: "Dashboard", href: "/company/dashboard", icon: LayoutDashboard },
  { name: "Branches", href: "/company/branches", icon: MapPin },
  { name: "Buses", href: "/company/buses", icon: Bus },
  { name: "Trips", href: "/company/trips", icon: CalendarDays },
  { name: "Bookings", href: "/company/bookings", icon: ClipboardList },
  { name: "Manifests", href: "/company/manifests", icon: ClipboardList },
  { name: "Staff", href: "/company/staff", icon: Users },
  { name: "Company Profile", href: "/company/profile", icon: UserCircle },
  { name: "Settings", href: "/company/settings", icon: Settings },
];

export function CompanySidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-64 hidden md:flex flex-col bg-[#0A192F] text-white">
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg">
            <Bus className="h-6 w-6 text-[#0A192F]" />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight leading-tight">Itike</h1>
            <p className="text-[10px] text-slate-400">Travel Smart. Travel Easy.</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
