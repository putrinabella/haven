// Safe-to-expose application errors. Anything NOT an AppError is treated as a bug: it is logged
// server-side and the client only ever sees a generic message (no stack, SQL, or internals).
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(401, "unauthorized", message);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this") {
    super(403, "forbidden", message);
  }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "not_found", message);
  }
}
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(409, "conflict", message);
  }
}
export class ValidationError extends AppError {
  constructor(message = "Invalid input", fieldErrors?: Record<string, string[]>) {
    super(422, "validation_failed", message, fieldErrors);
  }
}
export class PayloadTooLargeError extends AppError {
  constructor() {
    super(413, "payload_too_large", "Request body is too large");
  }
}
export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(429, "rate_limited", "Too many requests");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
/** The signed-in user has no active household (e.g. brand-new account that has not created one). */
export class NoHouseholdError extends AppError {
  constructor() {
    super(409, "no_household", "Create or join a household first");
  }
}
