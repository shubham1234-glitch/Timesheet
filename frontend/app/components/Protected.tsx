"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getRole, type Role } from "../lib/auth/client";

// Public routes that do not require auth
const PUBLIC_PATHS = new Set<string>(["/", "/Login"]);

// Role-based route protection
const getRequiredRole = (pathname: string): Role | null => {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/super-admin")) return "superadmin";
  if (pathname.startsWith("/employee")) return "employee";
  if (pathname.startsWith("/hr")) return "hr";
  return null;
};

export default function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.has(pathname || "/");
    const userRole = getRole();
    const requiredRole = getRequiredRole(pathname || "");

    if (!isPublic && !userRole) {
      router.replace("/Login");
      return;
    }

    if (!isPublic && requiredRole && userRole !== requiredRole) {
      // User doesn't have access to this role's routes
      router.replace("/Login");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  return <>{children}</>;
}


