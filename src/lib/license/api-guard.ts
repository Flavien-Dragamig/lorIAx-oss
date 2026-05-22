/**
 * API middleware for feature gating
 * Wraps request handlers to enforce feature availability
 */

import { NextRequest, NextResponse } from "next/server";
import { Feature } from "./types";
import { hasFeature } from "./gate";
import { getLicenseFromDB } from "./validate";

/**
 * Higher-order function to wrap API route handlers with feature gating
 * Usage: export const POST = requireFeature('sso')(async (req) => { ... })
 */
export function requireFeature(feature: Feature) {
  return (
    handler: (req: NextRequest) => Promise<Response>
  ) => {
    return async (req: NextRequest): Promise<Response> => {
      try {
        const license = await getLicenseFromDB();

        if (!hasFeature(license, feature)) {
          return NextResponse.json(
            {
              error: "Feature not available",
              message: `The feature '${feature}' is not available in your license plan.`,
              feature,
            },
            { status: 403 }
          );
        }

        return await handler(req);
      } catch (err) {
        console.error("License check failed:", err);
        return NextResponse.json(
          {
            error: "License check failed",
            message: "Could not verify license status.",
          },
          { status: 500 }
        );
      }
    };
  };
}

/**
 * Check if a specific feature is available
 * For use in route handlers to conditionally allow features
 */
export async function checkFeature(feature: Feature): Promise<boolean> {
  const license = await getLicenseFromDB();
  return hasFeature(license, feature);
}
