import { NextResponse, type NextRequest } from "next/server";
import {
  authenticateCalDAV,
  parseCalDAVPath,
  handlePropfind,
  handleReport,
  handleGetEvent,
  handlePutEvent,
  handleDeleteEvent,
  handleOptions,
} from "@/lib/calendar/caldav-server";

function isCaldavEnabled(): boolean {
  return process.env.CALDAV_ENABLED === "true";
}

function getBaseUrl(request: NextRequest): string {
  if (process.env.CALDAV_BASE_URL) return process.env.CALDAV_BASE_URL.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

function caldavHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    DAV: "1, 2, calendar-access",
    "Content-Type": "application/xml; charset=utf-8",
    ...extra,
  };
}

async function handleRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (!isCaldavEnabled()) {
    return NextResponse.json(
      { error: "CalDAV is disabled. Set CALDAV_ENABLED=true to enable." },
      { status: 503 }
    );
  }

  // Support X-HTTP-Method-Override for PROPFIND/REPORT (rewritten by server.ts)
  const override = request.headers.get("x-http-method-override");
  const method = override?.toUpperCase() || request.method.toUpperCase();

  // OPTIONS — no auth required
  if (method === "OPTIONS") {
    const result = handleOptions();
    return new NextResponse(null, { status: result.status, headers: result.headers });
  }

  // Authenticate
  const user = await authenticateCalDAV(request);
  if (!user) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="LorIAx CalDAV"' },
    });
  }

  const pathSegments = (await params).path;
  const parsedPath = parseCalDAVPath(pathSegments);
  const baseUrl = getBaseUrl(request);
  const body = method === "PROPFIND" || method === "REPORT" || method === "PUT"
    ? await request.text()
    : "";

  switch (method) {
    case "PROPFIND": {
      const result = await handlePropfind(user, parsedPath, body, baseUrl);
      return new NextResponse(result.body, {
        status: result.status,
        headers: caldavHeaders(),
      });
    }

    case "REPORT": {
      const result = await handleReport(user, parsedPath, body, baseUrl);
      return new NextResponse(result.body, {
        status: result.status,
        headers: caldavHeaders(),
      });
    }

    case "GET": {
      const result = await handleGetEvent(user, parsedPath);
      return new NextResponse(result.body, {
        status: result.status,
        headers: result.headers,
      });
    }

    case "PUT": {
      const result = await handlePutEvent(user, parsedPath, body);
      return new NextResponse(result.body || null, {
        status: result.status,
        headers: result.headers,
      });
    }

    case "DELETE": {
      const result = await handleDeleteEvent(user, parsedPath);
      return new NextResponse(result.body || null, { status: result.status });
    }

    default:
      return new NextResponse("Method not allowed", { status: 405 });
  }
}

// Next.js App Router: export handlers for each method
// CalDAV uses PROPFIND and REPORT which are non-standard, so we use catch-all via GET/POST/PUT/DELETE + custom method handling
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}

// PROPFIND and REPORT are non-standard HTTP methods
// Next.js doesn't support them directly — we handle them via the custom server (server.ts)
// or via a middleware rewrite. For now, clients can POST with X-HTTP-Method-Override header.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  // Allow PATCH as a fallback for PROPFIND/REPORT via X-HTTP-Method-Override
  return handleRequest(request, context);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return handleRequest(request, context);
}
