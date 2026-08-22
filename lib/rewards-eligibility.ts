export function normalizeRewardsEnabled(
  raw: Record<string, unknown> | null | undefined,
  fallback: boolean,
): boolean {
  if (typeof raw?.lamakoRewardsEnabled === "boolean") {
    return raw.lamakoRewardsEnabled;
  }
  if (typeof raw?.lamako_rewards_enabled === "boolean") {
    return raw.lamako_rewards_enabled;
  }
  return fallback;
}
