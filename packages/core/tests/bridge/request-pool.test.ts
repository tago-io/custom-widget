import { RequestPool } from "../../src/bridge/request-pool.js";
import type { TData, TError } from "../../src/types/index.js";

const mockData: TData = { status: true, result: [], key: "test-key" };
const mockError: TError = { status: false, message: "fail", result: [], key: "test-key" };

describe("RequestPool", () => {
  let pool: RequestPool;

  beforeEach(() => {
    pool = new RequestPool();
  });

  it("starts with size 0", () => {
    expect(pool.size).toBe(0);
  });

  it("adds and resolves a request", () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    pool.add("k1", { resolve, reject });
    expect(pool.size).toBe(1);
    expect(pool.has("k1")).toBe(true);

    const resolved = pool.resolve("k1", mockData);
    expect(resolved).toBe(true);
    expect(resolve).toHaveBeenCalledWith(mockData);
    expect(reject).not.toHaveBeenCalled();
    expect(pool.size).toBe(0);
  });

  it("adds and rejects a request", () => {
    const resolve = vi.fn();
    const reject = vi.fn();
    pool.add("k1", { resolve, reject });

    const rejected = pool.reject("k1", mockError);
    expect(rejected).toBe(true);
    expect(reject).toHaveBeenCalledWith(mockError);
    expect(resolve).not.toHaveBeenCalled();
    expect(pool.size).toBe(0);
  });

  it("returns false for unknown keys", () => {
    expect(pool.resolve("unknown", mockData)).toBe(false);
    expect(pool.reject("unknown", mockError)).toBe(false);
  });

  it("rejectAll rejects all pending requests", () => {
    const reject1 = vi.fn();
    const reject2 = vi.fn();
    pool.add("k1", { resolve: vi.fn(), reject: reject1 });
    pool.add("k2", { resolve: vi.fn(), reject: reject2 });

    const error = new Error("destroyed");
    pool.rejectAll(error);

    expect(reject1).toHaveBeenCalledWith(error);
    expect(reject2).toHaveBeenCalledWith(error);
    expect(pool.size).toBe(0);
  });
});
