import { ApiResponse } from "./ApiResponse";

export async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers, credentials: "include" });
    if (response.status === 401 && location.pathname.startsWith("/dashboard")) location.assign("/login");
    return ApiResponse.fromResponse<T>(response);
  } catch (error) { return ApiResponse.networkFailure<T>(error); }
}
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, file: File) => { const form = new FormData(); form.set("file", file); return request<T>(path, { method: "POST", body: form }); },
};
