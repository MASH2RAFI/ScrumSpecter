// A failed API response; the status lets callers tell access errors from transient failures
export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = "ApiError";
    }
}

export const isClientError = (error: unknown) =>
    error instanceof ApiError && error.status >= 400 && error.status < 500;

// The resource is gone or the user can no longer see it
export const isAccessError = (error: unknown) =>
    error instanceof ApiError && [401, 403, 404].includes(error.status);
