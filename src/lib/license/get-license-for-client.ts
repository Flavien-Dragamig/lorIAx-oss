import { unstable_cache } from "next/cache";
import { getLicenseFromDB } from "./validate";

export const getLicenseForClient = unstable_cache(
  async () => {
    const license = await getLicenseFromDB();
    if (!license) return null;
    return {
      plan: license.payload.plan,
      valid: license.valid,
      expired: license.expired,
      gracePeriod: license.gracePeriod,
      customerEmail: license.payload.customerEmail,
      expiresAt: license.payload.expiresAt,
    };
  },
  ["license"],
  { revalidate: 14400, tags: ["license"] }
);
