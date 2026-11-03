// Daily quota guard. Vendor AI calls cost real money per call; a runaway
// loop or an abusive user can burn a day of budget in minutes. Keep a
// per-feature daily counter in front of every paid call.
// The store is pluggable: in-memory by default, back it with your DB in prod.
export class DailyQuota {
  constructor(limits, { now = () => new Date() } = {}) {
    this.limits = limits; // { feature: maxPerDay }
    this.now = now;
    this.counters = new Map();
  }

  key(feature) {
    const d = this.now();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${day}:${feature}`;
  }

  usage(feature) {
    return this.counters.get(this.key(feature)) ?? 0;
  }

  remaining(feature) {
    const limit = this.limits[feature];
    if (limit === undefined) return Infinity;
    return Math.max(0, limit - this.usage(feature));
  }

  /** Consume n units if available. Returns { ok, remaining }. */
  tryConsume(feature, n = 1) {
    if (this.remaining(feature) < n) return { ok: false, remaining: this.remaining(feature) };
    this.counters.set(this.key(feature), this.usage(feature) + n);
    return { ok: true, remaining: this.remaining(feature) };
  }
}
