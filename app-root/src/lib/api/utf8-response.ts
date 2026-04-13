// UTF-8 Safe API Response Utilities
// Ensures all JSON responses include charset=utf-8 for proper Turkish character encoding

import { NextResponse } from "next/server";

/**
 * Creates a UTF-8 encoded JSON response
 * Use this instead of NextResponse.json() to ensure proper encoding
 */
export function jsonUtf8<T>(body: T, init?: ResponseInit & { status?: number }): NextResponse<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

/**
 * Creates a UTF-8 encoded error response
 */
export function errorUtf8(
  message: string,
  status: number = 500,
  init?: ResponseInit
): NextResponse<{ error: string }> {
  return jsonUtf8({ error: message }, { ...init, status });
}

/**
 * Creates a UTF-8 encoded success response
 */
export function successUtf8<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return jsonUtf8(data, { ...init, status: 200 });
}

/**
 * Helper to ensure all API routes return UTF-8 encoded responses
 * Usage in API routes:
 * 
 * export async function GET(request: Request) {
 *   const data = await fetchData();
 *   return jsonUtf8(data);
 * }
 */

/**
 * Content-Type header values for reference
 */
export const ContentType = {
  JSON_UTF8: "application/json; charset=utf-8",
  TEXT_UTF8: "text/plain; charset=utf-8",
  HTML_UTF8: "text/html; charset=utf-8",
} as const;
