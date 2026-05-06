import { NextResponse } from "next/server";
import type { ApiResponse } from "./types";

export function ok<T>(message: string, data: T, status = 200) {
  return NextResponse.json<ApiResponse<T>>({ success: true, message, data }, { status });
}

export function fail(error: string, status = 400) {
  return NextResponse.json<ApiResponse>({ success: false, error }, { status });
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error";
}
