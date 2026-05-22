import { NextResponse } from "next/server";

/**
 * Standard API v1 response envelope.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    cursor?: string | null;
    hasMore?: boolean;
    total?: number;
  };
}

export function apiSuccess<T>(
  data: T,
  meta?: ApiResponse["meta"],
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data, meta }, { status });
}

export function apiError(
  error: string,
  status = 400
): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error }, { status });
}

/**
 * Add rate limit headers to a response.
 */
export function withRateLimitHeaders(
  response: NextResponse,
  limit: number,
  remaining: number,
  resetMs: number
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(limit));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  response.headers.set(
    "X-RateLimit-Reset",
    String(Math.ceil(resetMs / 1000))
  );
  return response;
}
