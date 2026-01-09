"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  staggerContainer,
  itemFadeUp,
  slideInFromLeft,
  slideInFromRight,
  slideUp,
  inViewSlideFromRight,
  inViewSlideUp,
} from "../lib/motion";
import { setRole, type Role } from "../lib/auth/client";
import { fetchAndCacheMasterData, apiRequest } from "@/app/lib/api";
import { toast } from "react-hot-toast";

export default function Login() {
  const router = useRouter();
  const [userCode, setUserCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  // Avoid hydration mismatches for animated/in-view sections
  // by rendering them only after mount
  useEffect(() => { setMounted(true); }, []);

  // Variants and motion helpers are imported from ../lib/motion to keep this file lean

  function normalizeRole(userTypeCode: string, designationName: string): Role {
    const userType = (userTypeCode || "").trim().toUpperCase();
    const designation = (designationName || "").trim().toLowerCase();
    
    // Super Admin: user_type_code = "SA" OR designation_name is "mgmt" or "management"
    if (userType === "SA" || designation === "mgmt" || designation === "management") {
      return "superadmin";
    }
    
    // Admin: user_type_code = "E" and designation_name contains "admin"
    if (userType === "E" && designation.includes("admin")) {
      return "admin";
    }
    
    // HR: user_type_code = "E" and designation_name contains "hr"
    if (userType === "E" && designation.includes("hr")) {
      return "hr";
    }
    
    // Default: employee
    return "employee";
  }

  // const handleHardcodedAdminLogin = async () => {
  //   setError("");
  //   setLoading(true);
  //   try {
  //     const role: Role = "admin";
  //     const mockToken = "hardcoded-admin-token-" + Date.now();
  //     
  //     setRole(role);
  //     // Save hardcoded admin to localStorage
  //     try {
  //       const { setUserInStorage } = await import("../lib/auth/storage");
  //       setUserInStorage({
  //         accessToken: mockToken,
  //         role,
  //         rawRole: "Functional Admin",
  //         teamName: "Development",
  //         userCode: "ADMIN001",
  //         userName: "Admin User",
  //       });
  //     } catch {}
  //     
  //     // Try to fetch master data (may fail without real API, but that's okay)
  //     try { await fetchAndCacheMasterData(mockToken); } catch {}
  //     
  //     // Redirect to admin dashboard
  //     router.replace("/admin/dashboard");
  //   } catch (err) {
  //     setError("Failed to login as admin");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleHardcodedSuperAdminLogin = async () => {
  //   setError("");
  //   setLoading(true);
  //   try {
  //     const role: Role = "superadmin";
  //     const mockToken = "hardcoded-superadmin-token-" + Date.now();
  //     
  //     setRole(role);
  //     // Save hardcoded super admin to localStorage
  //     try {
  //       const { setUserInStorage } = await import("../lib/auth/storage");
  //       setUserInStorage({
  //         accessToken: mockToken,
  //         role,
  //         rawRole: "Super Admin",
  //         teamName: "Management",
  //         userCode: "SUPERADMIN001",
  //         userName: "Super Admin User",
  //       });
  //     } catch {}
  //     
  //     // Try to fetch master data (may fail without real API, but that's okay)
  //     try { await fetchAndCacheMasterData(mockToken); } catch {}
  //     
  //     // Redirect to super admin dashboard
  //     router.replace("/super-admin/dashboard");
  //   } catch (err) {
  //     setError("Failed to login as super admin");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleHardcodedHRLogin = async () => {
  //   setError("");
  //   setLoading(true);
  //   try {
  //     const role: Role = "hr";
  //     const mockToken = "hardcoded-hr-token-" + Date.now();
  //     
  //     setRole(role);
  //     // Save hardcoded HR to localStorage
  //     try {
  //       const { setUserInStorage } = await import("../lib/auth/storage");
  //       setUserInStorage({
  //         accessToken: mockToken,
  //         role,
  //         rawRole: "HR",
  //         teamName: "Human Resources",
  //         userCode: "HR001",
  //         userName: "HR User",
  //       });
  //     } catch {}
  //     
  //     // Try to fetch master data (may fail without real API, but that's okay)
  //     try { await fetchAndCacheMasterData(mockToken); } catch {}
  //     
  //     // Redirect to HR dashboard
  //     router.replace("/hr/dashboard");
  //   } catch (err) {
  //     setError("Failed to login as HR");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // const handleHardcodedEmployeeLogin = async () => {
  //   setError("");
  //   setLoading(true);
  //   try {
  //     const role: Role = "employee";
  //     const mockToken = "hardcoded-employee-token-" + Date.now();
  //     
  //     setRole(role);
  //     // Save hardcoded employee to localStorage
  //     try {
  //       const { setUserInStorage } = await import("../lib/auth/storage");
  //       setUserInStorage({
  //         accessToken: mockToken,
  //         role,
  //         rawRole: "Employee",
  //         teamName: "Development",
  //         userCode: "E00001",
  //         userName: "Employee User",
  //       });
  //     } catch {}
  //     
  //     // Try to fetch master data (may fail without real API, but that's okay)
  //     try { await fetchAndCacheMasterData(mockToken); } catch {}
  //     
  //     // Redirect to employee dashboard
  //     router.replace("/employee/dashboard");
  //   } catch (err) {
  //     setError("Failed to login as employee");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleLogin = async () => {
    if (!userCode.trim() || !password.trim()) {
      const msg = "Please enter Employee Code and Password";
      setError(msg);
      toast.error(msg);
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Call real login API (uppercase user_code to allow lowercase input)
      const payload = { user_code: userCode.trim().toUpperCase(), password: password.trim() };
      interface LoginResponse {
        success?: boolean;
        status_code?: number;
        status_message?: string;
        message?: string;
        access_token?: string;
        token_type?: string;
        user_info?: {
          user_code?: string;
          user_type?: string;
          user_type_code?: string;
          emp_name?: string;
          designation_name?: string;
          team_code?: string;
          team_name?: string;
          team_department?: string;
          reporter?: string | null;
          is_super_approver?: boolean;
          contact_num?: string | null;
          email_id?: string | null;
        };
      }
      const resp = await apiRequest<LoginResponse>("Login", "POST", payload);
      const token = resp?.access_token;
      const isSuccess = resp?.success === true && resp?.status_code === 200;
      
      if (!isSuccess || !token) {
        throw new Error(resp?.message || "Incorrect ID or password");
      }
      
      const userInfo = resp?.user_info;
      if (!userInfo) {
        throw new Error("User information not found in response");
      }
      
      // Normalize role based on user_type_code and designation_name
      const role: Role = normalizeRole(
        userInfo.user_type_code || "",
        userInfo.designation_name || ""
      );
      setRole(role);
      
      // Save token to localStorage in the format our api.ts understands
      try {
        const { setUserInStorage } = await import("../lib/auth/storage");
        setUserInStorage({
          accessToken: token,
          role,
          rawRole: userInfo.designation_name || userInfo.user_type || '',
          teamName: userInfo.team_name || '',
          userCode: userInfo.user_code || '',
          userName: userInfo.emp_name || '',
          isSuperApprover: userInfo.is_super_approver || false,
        });
      } catch {}
      
      // Prime master data cache (with token)
      try { await fetchAndCacheMasterData(token); } catch {}
      
      // Redirect by role
      const roleHome =
        role === "superadmin"
          ? "/super-admin/dashboard"
          : role === "admin"
          ? "/admin/dashboard"
          : role === "hr"
          ? "/hr/dashboard"
          : "/employee/dashboard";
      router.replace(roleHome);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left Section */}
      <motion.div
        className="relative w-full lg:w-1/2 flex items-center justify-center h-56 sm:h-72 lg:h-auto"
        {...slideInFromLeft(40, 0.6)}
      >
        <div className="absolute inset-0 bg-white bg-opacity-40" />
        {/* Image from login project (provide your own at /public/icons/login.png) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full">
          <Image
            src="/icons/login.png"
            alt="Background"
            fill
            priority
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
        <motion.div className="relative z-10 text-center" {...slideUp(24, 0.5)} transition={{ delay: 0.2, duration: 0.5 }}>
          <h1 className="text-[22px] font-bold bg-gradient-to-r from-[#00178F] to-[#4B96FF] bg-clip-text text-transparent">
            Welcome To
          </h1>
          <h1 className="text-[28px] font-bold bg-gradient-to-r from-[#00178F] to-[#4B96FF] bg-clip-text text-transparent">
            Sukraa Timesheet
          </h1>
			</motion.div>
		</motion.div>

      {/* Right Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 py-12 lg:py-0">
        <motion.div
          className="bg-white shadow-lg w-full max-w-[600px] flex flex-col justify-center p-4 sm:p-8 lg:p-10 rounded-sm mx-4"
          {...slideInFromRight(40, 0.6)}
        >
          {/* <div className="mb-8 flex justify-center">

            <Image src="/icons/SukraaLogo.png" alt="Logo" width={120} height={40} />
          </div> */}

          <motion.h2
            {...slideUp(24, 0.5)}
				className="text-xl sm:text-2xl font-semibold text-center mb-8 text-[#1a1a1a]"
			>
				Login
			</motion.h2>

          {/* Error Message */}
          {error && (
            <p className="text-red-500 text-sm text-center mb-3">{error}</p>
          )}

          <motion.form
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            {/* Employee Code */}
            <motion.div className="mb-6 relative" {...inViewSlideFromRight(30, 0.4, 0)}>
              <span className="absolute left-0 top-1/2 -translate-y-1/2">
                <Image src="/icons/username.png" alt="User" width={16} height={16} />
              </span>
              <input
                type="text"
                placeholder="E 00000"
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                className="w-full pl-6 pr-3 py-2 border-b border-[#e5e7eb] focus:outline-none focus:border-[#4B96FF] text-[14px]"
              />
				</motion.div>

            {/* Password */}
            <motion.div className="mb-6 relative" {...inViewSlideFromRight(30, 0.4, 0.05)}>
              <span className="absolute left-0 top-1/2 -translate-y-1/2">
                <Image src="/icons/lock.svg" alt="Password" width={16} height={16} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="**********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-6 pr-10 py-2 border-b border-[#e5e7eb] focus:outline-none focus:border-[#4B96FF] text-[14px]"
              />
              <button
                type="button"
                className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
						<motion.div whileTap={{ scale: 0.9 }}>
							<Image
                  src={showPassword ? "/icons/eye-off.png" : "/icons/eye.svg"}
                  alt={showPassword ? "Hide password" : "Show password"}
                  width={16}
                  height={16}
							/>
						</motion.div>
              </button>
				</motion.div>

            <motion.div className="flex items-center justify-between text-xs text-gray-500 mb-8" {...inViewSlideFromRight(30, 0.4, 0.1)}>
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-3 w-3 accent-[#4B96FF]"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => {}}
                className="text-gray-500 hover:text-[#4B96FF]"
              >
                Reset Password
              </button>
				</motion.div>

            {/* Login Button */}
				<motion.button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00178F] to-[#4B96FF] text-white py-2 rounded-sm transition cursor-pointer disabled:opacity-50"
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.98 }}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </motion.button>
            
            {mounted && (
              <motion.div className="flex items-center justify-center gap-3 mt-10 opacity-90" {...inViewSlideUp(20, 0.4, 0.15)}>
                <Image src="/icons/sukraa.png" alt="Sukraa" width={120} height={120}/>
              </motion.div>
            )}
			</motion.form>
		</motion.div>
      </div>
    </div>
  );
}
