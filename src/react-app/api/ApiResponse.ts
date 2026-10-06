import type { ApiEnvelope, ApiError } from "../../shared/api-types";

export class ApiResponse<T> {
  private constructor(readonly ok: boolean, readonly status: number, readonly data: T | null, readonly error: ApiError | null) {}
  static success<T>(data: T, status = 200) { return new ApiResponse(true, status, data, null); }
  static failure<T>(status: number, error: ApiError) { return new ApiResponse<T>(false, status, null, error); }
  static async fromResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let body: unknown;
    try { body = await response.json(); } catch { body = null; }
    if (body && typeof body === "object" && "success" in body && "data" in body && "error" in body) {
      const envelope = body as ApiEnvelope<T>;
      return new ApiResponse(envelope.success && response.ok, response.status, envelope.data, envelope.error);
    }
    return new ApiResponse<T>(false, response.status, null, { message: response.ok ? "The server returned an unexpected response" : `Request failed (${response.status})`, code: "INVALID_RESPONSE" });
  }
  static networkFailure<T>(error: unknown): ApiResponse<T> { return new ApiResponse<T>(false, 0, null, { message: error instanceof Error ? error.message : "Network request failed", code: "NETWORK_ERROR" }); }
  static adapted<T>(data: T | null, error: { message?: string; status?: number; code?: string } | null, status = 200): ApiResponse<T> {
    return new ApiResponse(!error, error?.status ?? status, data, error ? { message: error.message ?? "Authentication failed", code: error.code ?? "AUTH_ERROR" } : null);
  }
  isUnauthorized() { return this.status === 401; }
  isNotFound() { return this.status === 404; }
  isConflict() { return this.status === 409; }
}
