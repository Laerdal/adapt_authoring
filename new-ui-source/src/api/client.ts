// HTTP client wrapper for API requests.
// Adapted for the Adapt engine embed at /new: same-origin cookie session
// (no Bearer/localStorage), plain JSON bodies (the engine does not understand
// Headroom-compressed payloads). Auth/session handling lives in the auth context.

import { API_BASE_URL } from "@/utils/constants";
import { redirectToLogin } from "@/utils/authRedirect";

export interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

// Guards against showing the alert/redirecting more than once when several
// in-flight requests all 401 around the same time (e.g. a page that fires a
// handful of parallel calls right as the session dies).
let sessionExpiredHandled = false;

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    return { "Content-Type": "application/json" };
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = { ...this.getHeaders(), ...options.headers };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin", // carry the engine session cookie
      });

      if (!response.ok) {
        // Session expired/dropped mid-use. The new UI has no login page of its
        // own (see AuthContext) - redirectToLogin() sends the user wherever
        // the classic UI itself would (external SSO if configured, otherwise
        // /classic's own login form). Tell them why they're being moved
        // instead of a silent bounce, which used to leave people wondering
        // what just happened.
        if (response.status === 401 && !sessionExpiredHandled) {
          sessionExpiredHandled = true;
          alert("Your session has expired. Please log in again.");
          redirectToLogin();
        }
        const error = await response.json().catch(() => ({ message: response.statusText }));
        // Some services (e.g. plugins/services/ai-tutor) respond with a
        // `{ success: false, error }` envelope instead of `{ message }` — fall
        // back to that field too so callers see the server's real error text.
        const err = new Error(error.message || error.error || error.statusCode || `HTTP ${response.status}`);
        (err as Error & { status?: number }).status = response.status;
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
