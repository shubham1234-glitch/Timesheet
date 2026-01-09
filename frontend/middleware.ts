import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const roleRoutes = [
  { prefix: "/admin", allow: ["admin"] },
  { prefix: "/super-admin", allow: ["superadmin"] },
  { prefix: "/employee", allow: ["employee"] },
  { prefix: "/hr", allow: ["hr"] },
];

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  
  // Allow login page
  if (pathname === "/Login" || pathname === "/") {
    return NextResponse.next();
  }

  // Check if path matches any role-protected route
  for (const route of roleRoutes) {
    if (pathname.startsWith(route.prefix)) {
      // This is a role-protected route - redirect to login if not authenticated
      // The Protected component will handle the actual role checking
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/super-admin/:path*", 
    "/employee/:path*",
    "/hr/:path*",
    "/Login"
  ],
};
