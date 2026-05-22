import { describe, it, expect } from "vitest";
import { buildHeartbeatPayload } from "./heartbeat";

const settings = {
  enabled: true,
  contactEmail: "admin@exemple.fr",
  instanceId: "11111111-1111-1111-1111-111111111111",
};
const metrics = { users: 12, orgs: 2, spaces: 8 };

describe("buildHeartbeatPayload", () => {
  it("construit un payload complet à partir des réglages, de la version et des métriques", () => {
    const payload = buildHeartbeatPayload(settings, "1.19.2", metrics);
    expect(payload).toEqual({
      instance_id: "11111111-1111-1111-1111-111111111111",
      version: "1.19.2",
      contact_email: "admin@exemple.fr",
      metrics: { users: 12, orgs: 2, spaces: 8 },
    });
  });

  it("transmet contact_email null quand aucun email n'est renseigné", () => {
    const payload = buildHeartbeatPayload(
      { ...settings, contactEmail: null },
      "1.19.2",
      metrics
    );
    expect(payload.contact_email).toBeNull();
  });
});
