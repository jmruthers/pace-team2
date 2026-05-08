export interface ApiError {
  message: string;
  context?: string;
  cause?: unknown;
}

export type ApiResult<TData, TError extends ApiError = ApiError> =
  | { ok: true; data: TData }
  | { ok: false; error: TError };

export function apiOk<TData, TError extends ApiError = ApiError>(data: TData): ApiResult<TData, TError> {
  return { ok: true, data };
}

export function apiErr<TData = never, TError extends ApiError = ApiError>(error: TError): ApiResult<TData, TError> {
  return { ok: false, error };
}
