// utils/api.ts (client-friendly helper)

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Core request helper (normalizes base URL and handles auth + JSON)
export async function apiRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: unknown,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<T> {
  // Determine which base URL to use based on endpoint and method
  // Use NEXT_PUBLIC_BASE_URL for login, create, update operations, and GetMasterData
  // Use NEXT_PUBLIC_BASE_JS_URL for GET requests (epics/tasks listing and details, get_comments)
  const isWriteOperation = method === 'POST' || method === 'PUT' || method === 'DELETE';
  const isLoginOperation = endpoint.toLowerCase() === 'login';
  const isCreateOrUpdateOperation = endpoint.toLowerCase().startsWith('create_') || 
                                   endpoint.toLowerCase().startsWith('update_');
  const isMasterDataOperation = endpoint.toLowerCase() === 'getmasterdata';
  const isGetCommentsOperation = endpoint.toLowerCase().startsWith('get_comments');
  const isGetActivityOperation = endpoint.toLowerCase().startsWith('get_activity');
  const isGetTimesheetOperation = endpoint.toLowerCase().startsWith('get_timesheet');
  const isGetDashboardOperation = endpoint.toLowerCase().startsWith('get_dashboard');
  const isGetTeamDashboardOperation = endpoint.toLowerCase().startsWith('get_team_dashboard');
  const isGetSuperAdminDashboardOperation = endpoint.toLowerCase().startsWith('get_super_admin_dashboard');
  const isGetPredefinedEpicsOperation = endpoint.toLowerCase().startsWith('get_predefined_epics');
  const isGetOutdoorActivitiesOperation = endpoint.toLowerCase().startsWith('get_outdoor_activities');
  const isGetTicketsOperation = endpoint.toLowerCase().startsWith('get_ticket');
  
  // get_comments, get_activity, get_timesheet, get_dashboard, get_team_dashboard, get_super_admin_dashboard, get_predefined_epics, get_outdoor_activities, and get_tickets should use NEXT_PUBLIC_BASE_JS_URL (read operations)
  // DELETE operations (including delete_task) should use NEXT_PUBLIC_BASE_URL (write operations)
  const useBaseUrl = (isWriteOperation || isLoginOperation || isCreateOrUpdateOperation || isMasterDataOperation) && !isGetCommentsOperation && !isGetActivityOperation && !isGetTimesheetOperation && !isGetDashboardOperation && !isGetTeamDashboardOperation && !isGetSuperAdminDashboardOperation && !isGetPredefinedEpicsOperation && !isGetOutdoorActivitiesOperation && !isGetTicketsOperation;
  
  const rawBase = useBaseUrl
    ? (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '')
    : (process.env.NEXT_PUBLIC_BASE_JS_URL || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '');
  
  const baseUrl = rawBase
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^http:\/(?!\/)/i, 'http://')
    .replace(/^https:\/(?!\/)/i, 'https://')
    .replace(/\/+$/g, '');

  if (!baseUrl) {
    throw new ApiError("API base URL not configured");
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ApiError("API base URL must be absolute, e.g. http://localhost:5000/api");
  }

  const headers: HeadersInit = {};

  // If no token provided explicitly, try to read from localStorage on the client
  let authToken: string | undefined = token;
  let userCode: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      // Dynamic import to avoid SSR issues
      const storageModule = await import('./auth/storage');
      const user = storageModule.getUserFromStorage();
      if (user?.accessToken) {
        authToken = authToken || user.accessToken;
      }
      if (user?.userCode) {
        userCode = user.userCode;
      }
    } catch {
      // Fallback to direct localStorage access if dynamic import fails
      try {
        const raw = window.localStorage.getItem('user');
        if (raw) {
          const parsed = JSON.parse(raw) as { accessToken?: string; userCode?: string };
          if (parsed?.accessToken && typeof parsed.accessToken === 'string') {
            authToken = authToken || parsed.accessToken;
          }
          if (parsed?.userCode && typeof parsed.userCode === 'string') {
            userCode = parsed.userCode;
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (body && !(body instanceof FormData)) {
    // Support JSON and x-www-form-urlencoded bodies
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else {
      headers["Content-Type"] = "application/json";
    }
  }
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  // Merge any extra headers (e.g., impersonating a user via x-user-code)
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (typeof v === 'string') {
        headers[k] = v;
      }
    }
  }
  // Add user code header for timesheet and other user-specific endpoints
  // Only set from localStorage if not already provided in extraHeaders (for impersonation)
  if (userCode && !headers["x-user-code"]) {
    headers["x-user-code"] = userCode;
  }

  try {
    const fullUrl = `${baseUrl}/${String(endpoint || '').replace(/^\/+/, '')}`;
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: body
        ? body instanceof FormData
          ? body
          : (body instanceof URLSearchParams ? body.toString() : JSON.stringify(body))
        : undefined,
    });

    if (!res.ok) {
      let errorMessage = "API request failed";
      try {
        const errorData = await res.json() as { message?: string; error?: string; detail?: string };
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
      } catch {
        errorMessage = res.statusText || errorMessage;
      }
      throw new ApiError(errorMessage, res.status);
    }

    return res.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Network error occurred");
  }
}

// Master data helpers
const MASTER_DATA_KEY = 'masterData';

export type MasterData = unknown; // tighten when backend shape is known

export function getMasterDataFromCache<T = MasterData>(): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MASTER_DATA_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function clearMasterDataCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MASTER_DATA_KEY);
  } catch {
    // ignore
  }
}

// Call after successful login to prime dropdown data
export async function fetchAndCacheMasterData(token?: string) {
  const data = await apiRequest<MasterData>('GetMasterData', 'GET', undefined, token);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MASTER_DATA_KEY, JSON.stringify(data));
      // Notify listeners in other tabs/components
      try {
        window.dispatchEvent(new CustomEvent('masterDataUpdated'));
      } catch {}
    } catch {
      // ignore quota/serialization errors
    }
  }
  return data;
}


