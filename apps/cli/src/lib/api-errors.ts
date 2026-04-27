import type { ErrorEnvelope } from "@commit-analyzer/contracts";

type ApiErrorCode = "NETWORK" | "TIMEOUT" | "ABORTED" | "AUTH" | "API" | "STREAM" | "PROTOCOL";

class CliApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NetworkError extends CliApiError {
  constructor(message = "network error", options?: { cause?: unknown }) {
    super("NETWORK", message, options);
  }
}

export class TimeoutError extends CliApiError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, message = `request timed out after ${timeoutMs}ms`) {
    super("TIMEOUT", message);
    this.timeoutMs = timeoutMs;
  }
}

export class AbortError extends CliApiError {
  constructor(message = "request aborted") {
    super("ABORTED", message);
  }
}

export class AuthError extends CliApiError {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;

  constructor(status: number, envelope: ErrorEnvelope | null, message?: string) {
    super("AUTH", message ?? envelope?.error.message ?? "authentication failed");
    this.status = status;
    this.envelope = envelope;
  }
}

export class ApiResponseError extends CliApiError {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;

  constructor(status: number, envelope: ErrorEnvelope | null, message?: string) {
    super("API", message ?? envelope?.error.message ?? `request failed with status ${status}`);
    this.status = status;
    this.envelope = envelope;
  }
}

export class StreamError extends CliApiError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("STREAM", message, options);
  }
}

export class ProtocolError extends CliApiError {
  constructor(message: string) {
    super("PROTOCOL", message);
  }
}
