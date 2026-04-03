export function apiError(message: string, status: number = 400, details?: unknown) {
  return Response.json({ error: message, details, timestamp: new Date().toISOString() }, { status });
}

export function notFound(resource: string = "Resource") {
  return apiError(`${resource} not found`, 404);
}

export function unauthorized(message: string = "Unauthorized") {
  return apiError(message, 401);
}

export function serverError(message: string = "Internal server error") {
  return apiError(message, 500);
}
