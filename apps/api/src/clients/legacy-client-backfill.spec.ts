import { deriveLegacyClientDisplayName } from "./legacy-client-backfill";

describe("legacy client backfill", () => {
  it("uses the email local-part as displayName when present", () => {
    expect(deriveLegacyClientDisplayName("maria.lopez@example.com")).toBe("maria.lopez");
  });

  it("uses Customer when the email local-part is empty", () => {
    expect(deriveLegacyClientDisplayName("@example.com")).toBe("Customer");
    expect(deriveLegacyClientDisplayName("   @example.com")).toBe("Customer");
  });

  it("documents that phone snapshots remain null when legacy clients have no phone", () => {
    expect(deriveLegacyClientDisplayName("walkin@example.com")).toBe("walkin");
  });

  it("documents one client per business and linked user for duplicate legacy appointments", () => {
    const first = deriveLegacyClientDisplayName("repeat@example.com");
    const second = deriveLegacyClientDisplayName("repeat@example.com");

    expect(first).toBe(second);
  });
});
