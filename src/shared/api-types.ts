export type ApiError = {
  message: string;
  code: string;
  issues?: unknown;
};

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: ApiError | null;
};
