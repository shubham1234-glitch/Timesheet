// Type-safe localStorage utilities for user data

export interface UserData {
  accessToken: string;
  role: "admin" | "superadmin" | "employee" | "hr";
  rawRole?: string;
  teamName?: string;
  userCode?: string;
  userName?: string;
  isSuperApprover?: boolean;
}

const USER_KEY = "user";

export function getUserFromStorage(): UserData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserData>;
    
    // Validate required fields
    if (!parsed.accessToken || !parsed.role) {
      return null;
    }
    
    return parsed as UserData;
  } catch {
    return null;
  }
}

export function setUserInStorage(user: UserData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error("Failed to save user data to localStorage:", error);
  }
}

export function clearUserFromStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.error("Failed to clear user data from localStorage:", error);
  }
}

