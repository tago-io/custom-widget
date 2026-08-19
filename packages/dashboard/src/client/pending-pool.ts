export type TPendingEntry = {
  op: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

const EXPIRED_HISTORY_LIMIT = 64;

export class PendingPool {
  private readonly entries = new Map<string, TPendingEntry>();
  private readonly expired = new Set<string>();

  /** Refuses to overwrite: silently replacing an entry orphans the first promise forever. */
  add(id: string, entry: TPendingEntry): boolean {
    if (this.entries.has(id)) {
      return false;
    }
    this.entries.set(id, entry);
    return true;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  /** Removes before returning, so a duplicate response can never settle twice. */
  take(id: string): TPendingEntry | undefined {
    const entry = this.entries.get(id);
    if (entry) {
      this.entries.delete(id);
    }
    return entry;
  }

  /** Remember a timed-out id so a late answer is recognizable instead of merely unknown. */
  markExpired(id: string): void {
    this.expired.add(id);
    if (this.expired.size > EXPIRED_HISTORY_LIMIT) {
      const oldest = this.expired.values().next();
      if (!oldest.done) {
        this.expired.delete(oldest.value);
      }
    }
  }

  wasExpired(id: string): boolean {
    return this.expired.has(id);
  }

  drain(): TPendingEntry[] {
    const all = [...this.entries.values()];
    this.entries.clear();
    return all;
  }

  get size(): number {
    return this.entries.size;
  }
}
