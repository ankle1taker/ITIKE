/**
 * Structured API error that mirrors the backend's error response shape.
 *
 * Backend error format:
 *   { success: false, message: string, errors?: ZodIssue[], requestId?: string }
 */

export type ApiFieldError = {
  path: (string | number)[];
  message: string;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  fieldErrors?: ApiFieldError[];
  requestId?: string;

  constructor(
    message: string,
    status: number,
    options?: { fieldErrors?: ApiFieldError[]; requestId?: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = options?.fieldErrors;
    this.requestId = options?.requestId;
  }

  /** Convenience for forms: map field errors to a Record<fieldPath, message>. */
  fieldErrorMap(): Record<string, string> {
    const map: Record<string, string> = {};
    if (!this.fieldErrors) return map;
    for (const fe of this.fieldErrors) {
      const key = fe.path.join(".");
      map[key] = fe.message;
    }
    return map;
  }
}

/**
 * Normalise any thrown error into an ApiError instance.
 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof Error) {
    return new ApiError(err.message, 500);
  }
  return new ApiError("Unknown error", 500);
}