import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(null, { status: 200 });
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
