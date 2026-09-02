export class UploadRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly maximum = 5,
    private readonly windowMilliseconds = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  consume(
    key: string,
  ): { allowed: true } | { allowed: false; retryAfter: number } {
    const now = this.now();
    const current = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > now - this.windowMilliseconds,
    );
    if (current.length >= this.maximum) {
      const retryAfter = Math.max(
        1,
        Math.ceil((current[0]! + this.windowMilliseconds - now) / 1000),
      );
      this.attempts.set(key, current);
      return { allowed: false, retryAfter };
    }
    current.push(now);
    this.attempts.set(key, current);
    return { allowed: true };
  }
}
