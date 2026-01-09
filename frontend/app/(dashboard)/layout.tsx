"use client";
import Protected from "../components/Protected";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { fetchAndCacheMasterData, getMasterDataFromCache } from "../lib/api";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Refresh master data on every navigation/route change
    // This includes sidebar navigation, programmatic redirects, and full page refreshes
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname || null;
      (async () => {
        try {
          await fetchAndCacheMasterData();
        } catch {
          // ignore fetch errors; UI will still function with previous cache
        }
      })();
    }
  }, [pathname]);
  return (
    <Protected>
      <div className="min-h-screen flex flex-col lg:flex-row">
        <Sidebar
          isMobileOpen={mobileSidebarOpen}
          onToggleMobile={() => setMobileSidebarOpen((v) => !v)}
          onRequestClose={() => setMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
          <Navbar onToggleSidebar={() => setMobileSidebarOpen((v) => !v)} />
          <main className="flex-1 overflow-x-auto lg:ml-0">{children}</main>
        </div>
      </div>
    </Protected>
  );
}


