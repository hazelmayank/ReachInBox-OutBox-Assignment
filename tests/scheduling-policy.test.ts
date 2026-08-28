import { describe, expect, it } from "vitest";
import { effectiveDeliveryPolicy, scheduledTime } from "../src/modules/emails/scheduling-policy.js";

describe("scheduling policy", () => {
  it("spaces recipients from the campaign start time", () => {
    const start = new Date("2026-08-28T10:00:00.000Z");
    expect(scheduledTime(start, 3, 2_000).toISOString()).toBe("2026-08-28T10:00:06.000Z");
  });

  it("never allows a campaign to weaken system safety limits", () => {
    expect(effectiveDeliveryPolicy(100, 1_000, 2_000, 200)).toEqual({ delayMs: 2_000, hourlyLimit: 200 });
  });

  it("allows a campaign to choose stricter limits", () => {
    expect(effectiveDeliveryPolicy(5_000, 50, 2_000, 200)).toEqual({ delayMs: 5_000, hourlyLimit: 50 });
  });
});
