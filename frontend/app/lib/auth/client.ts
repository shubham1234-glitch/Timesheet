"use client";

import { getUserFromStorage } from "./storage";

export type Role = "admin" | "superadmin" | "employee" | "hr";

const ROLE_KEY = "app.role";

export function setRole(role: Role) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
}

export function getRole(): Role | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(ROLE_KEY) as Role | null;
  return v ?? null;
}

export function clearRole() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ROLE_KEY);
}

/**
 * Check if the current user is a super approver
 * @returns true if user is a super approver, false otherwise
 */
export function isSuperApprover(): boolean {
  if (typeof window === "undefined") return false;
  const userData = getUserFromStorage();
  return userData?.isSuperApprover === true;
}


