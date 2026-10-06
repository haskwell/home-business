import type { Context } from "hono";
import type { ApiEnvelope } from "../../shared/api-types";

export class ApiResponse<T> {
  private constructor(
    readonly success: boolean,
    readonly data: T | null,
    readonly error: ApiEnvelope<T>["error"],
    readonly status: number,
  ) {}

  static success<T>(data: T, status = 200) { return new ApiResponse(true, data, null, status); }
  static failure(status: number, message: string, code: string, issues?: unknown) {
    return new ApiResponse<never>(false, null, { message, code, ...(issues === undefined ? {} : { issues }) }, status);
  }
  static ok<T>(data: T, status = 200) { return this.success(data, status); }
  static fail(status: number, message: string, code: string, issues?: unknown) { return this.failure(status, message, code, issues); }
  static unauthorized(message = "Authentication required") { return this.failure(401, message, "UNAUTHORIZED"); }
  static forbidden(message = "You do not have access to this resource") { return this.failure(403, message, "FORBIDDEN"); }
  static notFound(message = "Resource not found") { return this.failure(404, message, "NOT_FOUND"); }
  static conflict(message: string) { return this.failure(409, message, "CONFLICT"); }
  static validation(message: string, issues?: unknown) { return this.failure(400, message, "VALIDATION_ERROR", issues); }

  toResponse(c: Context, headers?: HeadersInit): Response {
    return c.json({ success: this.success, data: this.data, error: this.error }, this.status as never, headers);
  }

  // Transitional adapter keeps each route's existing payload and status intact.
  static fromLegacy<T>(c: Context, body: T, status = 200): Response {
    if (status >= 400 && body && typeof body === "object" && "error" in body) {
      const legacy = body as { error: unknown; itemIds?: number[] };
      const message = typeof legacy.error === "string" ? legacy.error : "Request failed";
      const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : status === 409 ? "CONFLICT" : status === 400 ? "VALIDATION_ERROR" : "INTERNAL_ERROR";
      return ApiResponse.fail(status, message, code, legacy.itemIds ? { itemIds: legacy.itemIds } : undefined).toResponse(c);
    }
    return ApiResponse.ok(body, status).toResponse(c);
  }
}

export function validationHook(result: { success: boolean; error?: { issues: unknown } }, c: Context) {
  if (!result.success) return ApiResponse.validation("Request validation failed", result.error?.issues).toResponse(c);
}
