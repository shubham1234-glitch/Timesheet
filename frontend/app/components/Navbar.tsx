"use client";
import { getRole, clearRole } from "../lib/auth/client";
import { clearMasterDataCache } from "../lib/api";
import { usePathname, useRouter } from "next/navigation";
import { memo, useMemo, useCallback } from "react";

const Navbar = memo(function Navbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const role = getRole() ?? "employee";
  const pathname = usePathname();
  const router = useRouter();

  const getPageTitle = useCallback((path: string) => {
    if (path.includes("/dashboard")) return "Dashboard";
    if (path.includes("/timesheet")) return "Timesheet";
    if (path.includes("/tasks")) return "Tasks";
    if (path.includes("/performance")) return "Performance";
    if (path.includes("/leave-registry")) return "Leave Registry";
    return "Dashboard";
  }, []);

  const pageTitle = useMemo(() => getPageTitle(pathname), [pathname, getPageTitle]);

  const handleSignOut = useCallback(async () => {
    clearRole();
    try { clearMasterDataCache(); } catch {}
    try {
      const { clearUserFromStorage } = await import("../lib/auth/storage");
      clearUserFromStorage();
    } catch {}
    router.replace("/Login");
  }, [router]);

  return (
    <header className="sticky top-0 z-40 h-12 bg-gradient-to-r from-[#4AA3FF] to-[#001B9A] shadow-sm flex items-center justify-between px-4 sm:px-6" aria-label={`Top bar for ${role}`}>
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 bg-white/10 rounded-md focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 12h18M3 6h18M3 18h18" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
        <h1 className="text-white font-semibold text-base sm:text-lg truncate">{pageTitle}</h1>
      </div>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 text-white hover:text-gray-100 text-xs sm:text-sm font-medium px-3 sm:px-4 py-2 rounded-md hover:bg-white/20 active:bg-white/30 border border-white/20 hover:border-white/40 transition-all duration-200 whitespace-nowrap shadow-sm hover:shadow-md"
        aria-label="Sign out"
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="flex-shrink-0"
        >
          <path 
            d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
        <span>Sign out</span>
      </button>
    </header>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;


