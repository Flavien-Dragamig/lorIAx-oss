import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // RFC 6764: .well-known/caldav redirects to the CalDAV principal URL
  // Without authentication we redirect to the base CalDAV path
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  const baseUrl = process.env.CALDAV_BASE_URL || `${proto}://${host}`;

  return NextResponse.redirect(`${baseUrl}/api/caldav/`, { status: 301 });
}

// CalDAV clients may PROPFIND .well-known/caldav
export async function POST(request: NextRequest) {
  return GET(request);
}
