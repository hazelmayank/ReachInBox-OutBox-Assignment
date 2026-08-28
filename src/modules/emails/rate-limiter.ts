import { redis } from "../../lib/redis.js";

const claimScript = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count >= tonumber(ARGV[2]) then
  local firstNotice = redis.call('SET', KEYS[3], '1', 'NX', 'PX', ARGV[4])
  return {tonumber(ARGV[3]), 1, firstNotice and 1 or 0}
end
local lastSend = tonumber(redis.call('GET', KEYS[2]) or '0')
local earliest = lastSend + tonumber(ARGV[5])
if earliest > tonumber(ARGV[1]) then
  return {earliest - tonumber(ARGV[1]), 0, 0}
end
redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ARGV[4])
redis.call('SET', KEYS[2], ARGV[1], 'PX', math.max(tonumber(ARGV[5]) * 2, 60000))
return {0, 0, 0}
`;

export interface RateClaim { delayMs: number; hourlyLimitHit: boolean; shouldNotify: boolean; nextHour: Date }

export async function claimSendSlot(senderId: string, hourlyLimit: number, minimumDelayMs: number): Promise<RateClaim> {
  const now = Date.now();
  const nextHourMs = (Math.floor(now / 3_600_000) + 1) * 3_600_000;
  const hourKey = new Date(now).toISOString().slice(0, 13);
  const ttl = nextHourMs - now + 60_000;
  const result = await redis.eval(
    claimScript,
    3,
    `rate:hour:${senderId}:${hourKey}`,
    `rate:last-send:${senderId}`,
    `rate:notified:${senderId}:${hourKey}`,
    now,
    hourlyLimit,
    nextHourMs - now,
    ttl,
    minimumDelayMs
  ) as [number, number, number];
  return {
    delayMs: Number(result[0]),
    hourlyLimitHit: Number(result[1]) === 1,
    shouldNotify: Number(result[2]) === 1,
    nextHour: new Date(nextHourMs)
  };
}

export async function releaseNotificationClaim(senderId: string, nextHour: Date) {
  const currentWindow = new Date(nextHour.getTime() - 3_600_000).toISOString().slice(0, 13);
  await redis.del(`rate:notified:${senderId}:${currentWindow}`);
}
