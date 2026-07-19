export class AppError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
    public readonly code = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string) {
    super(message, 503, "CONFIGURATION_ERROR");
    this.name = "ConfigurationError";
  }
}

export class RateLimitError extends AppError {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests. Wait a moment, then try again.", 429, "RATE_LIMITED");
    this.name = "RateLimitError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof SyntaxError) {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "The request body is not valid JSON." } },
      { status: 400 },
    );
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "The submitted data is invalid.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const appError =
    error instanceof AppError
      ? error
      : new AppError("Something went wrong. Please try again.");

  return Response.json(
    { error: { code: appError.code, message: appError.message } },
    {
      status: appError.status,
      headers: appError instanceof RateLimitError
        ? { "Retry-After": String(appError.retryAfterSeconds), "Cache-Control": "no-store" }
        : undefined,
    },
  );
}
import { ZodError } from "zod";
