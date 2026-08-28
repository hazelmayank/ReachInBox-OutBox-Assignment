export function scheduledTime(startTime: Date, sequence: number, delayMs: number) {
  return new Date(startTime.getTime() + sequence * delayMs);
}

export function effectiveDeliveryPolicy(
  campaignDelayMs: number,
  campaignHourlyLimit: number,
  minimumDelayMs: number,
  maximumHourlyLimit: number
) {
  return {
    delayMs: Math.max(campaignDelayMs, minimumDelayMs),
    hourlyLimit: Math.min(campaignHourlyLimit, maximumHourlyLimit)
  };
}
