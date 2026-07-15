import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  const body: ApiSuccess<T> = {
    ok: true,
    data,
    requestId: generateRequestId(),
  };
  return NextResponse.json(body, { status, headers });
}

export function apiFailure(code: string, message: string, status = 500, requestId?: string) {
  const body: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
    },
    requestId: requestId || generateRequestId(),
  };
  return NextResponse.json(body, { status });
}
