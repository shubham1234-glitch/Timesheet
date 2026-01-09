"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navByRole, type Role } from "../lib/nav";
import { getRole } from "../lib/auth/client";
import Image from "next/image";
import { useState, useMemo, memo } from "react";
import { getSidebarIcon } from "./SidebarIcons";

const Sidebar = memo(function Sidebar({ isMobileOpen = false, onToggleMobile, onRequestClose }: { isMobileOpen?: boolean; onToggleMobile?: () => void; onRequestClose?: () => void; }) {
  const pathname = usePathname();
  const role = (getRole() ?? "employee") as Role;
  const items = useMemo(() => navByRole[role] || [], [role]);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onRequestClose}
        />
      )}

      <aside className={`
        ${isCollapsed ? 'w-16' : 'w-60'} 
        border-l-4 border-blue-200 bg-white flex flex-col transition-all duration-300 shadow-lg
        fixed lg:sticky lg:top-0 z-50 h-screen lg:h-screen
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center gap-2 mb-1">
              <div className="relative">
                <Image src="/icons/sukraa.png" alt="Sukraa" width={120} height={120} />
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18l-6-6 6-6" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <nav className="p-3 flex-1 space-y-2">
        {items.map((it) => {
          const active = pathname?.startsWith(it.href);
          const IconComponent = getSidebarIcon(it.label);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm rounded ${
                active ? "bg-[#E6F4FB] text-gray-900 border-l-4 border-[#1B90CA]" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              }`}
              title={isCollapsed ? it.label : undefined}
            >
              <IconComponent />
              {!isCollapsed && it.label}
            </Link>
          );
        })}
      </nav>
      </aside>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;


