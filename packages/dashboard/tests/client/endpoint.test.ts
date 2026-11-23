import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { DashboardClient } from "../../src/client/dashboard-client.js";
import { setupClient } from "../helpers/host.js";

const ANALYSIS_ID = "6a1f0c2b9e8d7f6a5b4c3d2e";
const OTHER_ANALYSIS_ID = "6a1f0c2b9e8d7f6a5b4c3d2f";

let ctx: ReturnType<typeof setupClient> | undefined;

afterEach(() => {
  ctx?.client.stop();
  ctx = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("endpoint.list", () => {
  it("posts the bare envelope and resolves the Endpoints the viewer may call", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.list();

    const request = ctx.requests()[0];
    expect(request.op).toBe("endpoint.list");
    expect(request).not.toHaveProperty("payload");

    ctx.respondOk({ endpoints: [{ id: ANALYSIS_ID, name: "Save setpoint" }] });
    await expect(promise).resolves.toEqual([{ id: ANALYSIS_ID, name: "Save setpoint" }]);
  });

  it("skips entries without an id and names a nameless one after its id", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.list();

    ctx.respondOk({ endpoints: [null, { name: "no id" }, { id: ANALYSIS_ID }, "x"] });
    await expect(promise).resolves.toEqual([{ id: ANALYSIS_ID, name: ANALYSIS_ID }]);
  });

  it("resolves an empty list when the reply has no endpoints array", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.list();

    ctx.respondOk({});
    await expect(promise).resolves.toEqual([]);
  });

  it("rejects a reply that is not an object as api_error", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.list();

    ctx.respondOk("nope");
    await expect(promise).rejects.toMatchObject({ code: "api_error", op: "endpoint.list" });
  });

  it("shares one request between identical concurrent lists", async () => {
    ctx = setupClient();
    const first = ctx.client.endpoint.list();
    const second = ctx.client.endpoint.list();

    expect(ctx.requests()).toHaveLength(1);

    ctx.respondOk({ endpoints: [{ id: ANALYSIS_ID, name: "a" }] });
    expect(await first).toEqual(await second);
  });

  it("forwards a host failure with its code", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.list();

    ctx.respondError("forbidden", "Authorization denied");
    await expect(promise).rejects.toMatchObject({ code: "forbidden", op: "endpoint.list" });
  });
});

describe("endpoint.call request", () => {
  it("sends only the Analysis ID when no request is given", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);

    const request = ctx.requests()[0];
    expect(request.op).toBe("endpoint.call");
    expect(request.payload).toEqual({ endpoint_id: ANALYSIS_ID });

    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await promise;
  });

  it("puts method, path, query and body on the wire under the host's field names", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, {
      method: "POST",
      path: "/setpoint",
      query: { room: "4", dry: true, tag: ["a", "b"], step: 2 },
      body: { setpoint: "22" },
    });

    expect(ctx.requests()[0].payload).toEqual({
      endpoint_id: ANALYSIS_ID,
      method: "POST",
      path: "/setpoint",
      query: { room: "4", dry: true, tag: ["a", "b"], step: 2 },
      body: { setpoint: "22" },
    });

    ctx.respondOk({ status: 200, headers: {}, body: { ok: true } });
    await promise;
  });

  it("leaves out the fields the request does not set", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { path: "/status", method: undefined });

    expect(ctx.requests()[0].payload).toEqual({ endpoint_id: ANALYSIS_ID, path: "/status" });
    expect(ctx.requests()[0].payload).not.toHaveProperty("method");

    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await promise;
  });

  it("sends a string body as is", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body: '{"raw":1}' });

    expect((ctx.requests()[0].payload as { body: unknown }).body).toBe('{"raw":1}');

    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await promise;
  });

  it("encodes the body with JSON's rules, so toJSON applies before the host sees it", async () => {
    ctx = setupClient();
    const at = new Date("2026-11-23T12:00:00.000Z");
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, {
      method: "POST",
      body: { at, skipped: undefined, items: [1, undefined] },
    });

    expect((ctx.requests()[0].payload as { body: unknown }).body).toEqual({
      at: "2026-11-23T12:00:00.000Z",
      items: [1, null],
    });

    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await promise;
  });

  it("refuses a body JSON cannot encode, before anything is posted", async () => {
    ctx = setupClient();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    await expect(ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body: { big: 1n } })).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    await expect(ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body: cycle })).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    await expect(ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body: () => 1 })).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    expect(ctx.requests()).toHaveLength(0);
  });

  it("refuses a body whose JSON is a bare string, which the host would send as text instead of JSON", async () => {
    ctx = setupClient();

    for (const body of [new Date("2026-11-23T12:00:00.000Z"), { toJSON: () => "22" }]) {
      await expect(ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body })).rejects.toMatchObject({
        code: "bad_request",
        op: "endpoint.call",
      });
    }
    expect(ctx.requests()).toHaveLength(0);
  });

  it("sends a top-level number, boolean or null body as its JSON value", async () => {
    ctx = setupClient();

    for (const body of [22, false, null]) {
      void ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body }).catch(() => undefined);
    }
    expect(ctx.requests().map((request) => (request.payload as { body: unknown }).body)).toEqual([22, false, null]);
  });

  it("refuses an Analysis ID that is not 24 alphanumeric characters, without a round trip", async () => {
    ctx = setupClient();

    for (const analysisID of ["", "nope", `${ANALYSIS_ID}0`, "../6a1f0c2b9e8d7f6a5b4c3d", 42]) {
      await expect(ctx.client.endpoint.call(analysisID as string)).rejects.toMatchObject({
        code: "bad_request",
        op: "endpoint.call",
      });
    }
    expect(ctx.requests()).toHaveLength(0);
  });
});

describe("endpoint.call answers", () => {
  it.each([200, 201, 204, 400, 401, 403, 404, 413, 422, 429, 500, 502, 504])(
    "resolves an HTTP %i answer with its status, headers and body",
    async (status) => {
      ctx = setupClient();
      const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", path: "/setpoint" });

      ctx.respondOk({ status, headers: { "content-type": "application/json" }, body: { status } });
      await expect(promise).resolves.toEqual({
        status,
        headers: { "content-type": "application/json" },
        body: { status },
      });
    }
  );

  it("hands a 422 body to the caller untouched, so a form can read its field errors", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call<{ errors: { setpoint: string } }>(ANALYSIS_ID, {
      method: "POST",
      path: "/setpoint",
      body: { setpoint: "50" },
    });

    ctx.respondOk({ status: 422, headers: {}, body: { errors: { setpoint: "Enter a number from 5 to 30." } } });
    const answer = await promise;
    expect(answer.body.errors.setpoint).toBe("Enter a number from 5 to 30.");
  });

  it("keeps a text body as text", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);

    ctx.respondOk({ status: 200, headers: { "content-type": "text/plain" }, body: "hello" });
    await expect(promise).resolves.toMatchObject({ body: "hello" });
  });

  it("drops header values that are not strings", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);

    ctx.respondOk({ status: 200, headers: { "x-a": "1", "x-b": 2, "x-c": null }, body: "" });
    await expect(promise).resolves.toMatchObject({ headers: { "x-a": "1" } });
  });

  it.each([
    ["a result that is not an object", "nope"],
    ["a result without a status", { headers: {}, body: "" }],
    ["a status that is not a number", { status: "200", headers: {}, body: "" }],
    ["headers that are not an object", { status: 200, headers: "x", body: "" }],
  ])("rejects %s as api_error", async (_label, result) => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);

    ctx.respondOk(result);
    await expect(promise).rejects.toMatchObject({ code: "api_error", op: "endpoint.call" });
  });

  it.each(["bad_request", "api_error", "unknown_op", "a_code_from_a_newer_host"])(
    "rejects a %s reply from the host with that code and the request id",
    async (code) => {
      ctx = setupClient();
      const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" });
      const requestID = ctx.lastRequestID();

      ctx.respondError(code, "The Endpoint call failed");
      await expect(promise).rejects.toMatchObject({ code, op: "endpoint.call", requestID });
    }
  );
});

describe("endpoint.call correlation", () => {
  it("never shares a request between identical calls, since each one is its own save", async () => {
    ctx = setupClient();
    const request = { method: "POST" as const, path: "/setpoint", body: { setpoint: "22" } };
    const first = ctx.client.endpoint.call(ANALYSIS_ID, request);
    const second = ctx.client.endpoint.call(ANALYSIS_ID, request);

    const [firstRequest, secondRequest] = ctx.requests();
    expect(ctx.requests()).toHaveLength(2);
    expect(firstRequest.id).not.toBe(secondRequest.id);
    expect(firstRequest.payload).toEqual(secondRequest.payload);

    ctx.respondOk({ status: 200, headers: {}, body: { n: 1 } }, firstRequest.id as string);
    ctx.respondOk({ status: 200, headers: {}, body: { n: 2 } }, secondRequest.id as string);
    await expect(first).resolves.toMatchObject({ body: { n: 1 } });
    await expect(second).resolves.toMatchObject({ body: { n: 2 } });
  });

  it("settles each call with its own answer when the answers arrive out of order", async () => {
    ctx = setupClient();
    const first = ctx.client.endpoint.call(ANALYSIS_ID, { path: "/a" });
    const second = ctx.client.endpoint.call(OTHER_ANALYSIS_ID, { path: "/b" });
    const [firstRequest, secondRequest] = ctx.requests();

    ctx.respondOk({ status: 404, headers: {}, body: "b" }, secondRequest.id as string);
    ctx.respondOk({ status: 200, headers: {}, body: "a" }, firstRequest.id as string);

    await expect(first).resolves.toMatchObject({ status: 200, body: "a" });
    await expect(second).resolves.toMatchObject({ status: 404, body: "b" });
  });

  it("settles a call once, ignoring a duplicated answer", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);
    const requestID = ctx.lastRequestID();

    ctx.respondOk({ status: 200, headers: {}, body: "first" }, requestID);
    ctx.respondOk({ status: 500, headers: {}, body: "second" }, requestID);

    await expect(promise).resolves.toMatchObject({ status: 200, body: "first" });
    expect(ctx.client.pendingCount).toBe(0);
  });
});

describe("endpoint.call when it cannot complete", () => {
  it("keeps the transport backstop, rejecting with no_response once the default deadline passes", async () => {
    vi.useFakeTimers();
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" });

    const assertion = expect(promise).rejects.toMatchObject({
      code: "no_response",
      op: "endpoint.call",
      message: expect.stringMatching(/may have run/),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });

  it("waits indefinitely when the call sets timeoutMs to 0", async () => {
    vi.useFakeTimers();
    ctx = setupClient();
    let settled = false;
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" }, { timeoutMs: 0 });
    void promise.finally(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(settled).toBe(false);

    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await expect(promise).resolves.toMatchObject({ status: 200 });
  });

  it("rejects with aborted and the request id, saying the call may have run, when the client stops after sending it", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" });
    expect(ctx.requests()).toHaveLength(1);
    const requestID = ctx.lastRequestID();

    ctx.client.stop();
    await expect(promise).rejects.toMatchObject({
      code: "aborted",
      op: "endpoint.call",
      requestID,
      message: expect.stringMatching(/may have run/),
    });
  });

  it("logs a late answer to a call the client stopped, instead of dropping it silently", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    ctx = setupClient();
    void ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" }).catch(() => undefined);
    const requestID = ctx.lastRequestID() as string;

    ctx.client.stop();
    ctx.client.start();
    ctx.respondOk({ status: 200, headers: {}, body: "" }, requestID);

    expect(debug).toHaveBeenCalledWith(expect.stringContaining(requestID));
  });

  it("aborts a call made while the client is not running without sending it or claiming it ran", async () => {
    ctx = setupClient();
    ctx.client.stop();

    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST" });
    const rejection = await promise.catch((error: unknown) => error);

    expect(rejection).toMatchObject({ code: "aborted", op: "endpoint.call" });
    expect((rejection as { requestID?: string }).requestID).toBeUndefined();
    expect((rejection as Error).message).not.toMatch(/may have run/);
    expect(ctx.requests()).toHaveLength(0);
  });

  it("fails fast with no_host when the page is not embedded", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const client = new DashboardClient();
    client.start();

    await expect(client.endpoint.call(ANALYSIS_ID)).rejects.toMatchObject({ code: "no_host", op: "endpoint.call" });
    await expect(client.endpoint.list()).rejects.toMatchObject({ code: "no_host", op: "endpoint.list" });
    client.stop();
  });
});

describe("endpoint.call request checks", () => {
  it.each([
    [
      "a FormData",
      () => {
        const form = new FormData();
        form.append("setpoint", "22");
        return form;
      },
    ],
    ["a Map", () => new Map([["setpoint", "22"]])],
    ["a Set", () => new Set(["22"])],
    ["a URLSearchParams", () => new URLSearchParams("setpoint=22")],
    ["a Blob", () => new Blob(["22"])],
    [
      "a class instance that keeps its data in private fields",
      () =>
        new (class Temperature {
          #celsius = 22;
          get celsius() {
            return this.#celsius;
          }
        })(),
    ],
    ["a Map inside an object", () => ({ values: new Map([["a", 1]]) })],
  ])("refuses %s as the body, which JSON would turn into {}, before posting", async (_label, make) => {
    ctx = setupClient();

    await expect(ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body: make() })).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    expect(ctx.requests()).toHaveLength(0);
  });

  it("sends plain objects, arrays, prototype-free objects, toJSON results and class instances with fields", () => {
    ctx = setupClient();
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { a: 1 });
    class Setpoint {
      constructor(readonly value: number) {}
    }
    const bodies = [
      { a: [1, { b: "c" }] },
      [1, 2],
      bare,
      { at: new Date("2026-11-23T12:00:00.000Z") },
      { toJSON: () => ({ v: 1 }) },
      new Setpoint(22),
      {},
    ];

    for (const body of bodies) {
      void ctx.client.endpoint.call(ANALYSIS_ID, { method: "POST", body }).catch(() => undefined);
    }

    expect(ctx.requests().map((request) => (request.payload as { body: unknown }).body)).toEqual([
      { a: [1, { b: "c" }] },
      [1, 2],
      { a: 1 },
      { at: "2026-11-23T12:00:00.000Z" },
      { v: 1 },
      { value: 22 },
      {},
    ]);
  });

  it.each([
    ["a URLSearchParams", () => new URLSearchParams("device=abc")],
    ["a Map", () => new Map([["device", "abc"]])],
    ["a Date", () => new Date("2026-11-23T12:00:00.000Z")],
    ["an array", () => ["device", "abc"]],
  ])("refuses %s as the query, which would go out empty, before posting", async (_label, make) => {
    ctx = setupClient();

    await expect(
      ctx.client.endpoint.call(ANALYSIS_ID, { query: make() as unknown as Record<string, string> })
    ).rejects.toMatchObject({ code: "bad_request", op: "endpoint.call" });
    expect(ctx.requests()).toHaveLength(0);
  });

  it.each([
    ["a string", "/setpoint"],
    ["a number", 22],
    ["null", null],
    ["an array", [{ method: "POST" }]],
  ])("refuses %s as the request, which would run GET / instead, before posting", async (_label, request) => {
    ctx = setupClient();

    await expect(ctx.client.endpoint.call(ANALYSIS_ID, request as never)).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    expect(ctx.requests()).toHaveLength(0);
  });

  it("refuses an Analysis ID it cannot print, such as a click event, as bad_request", async () => {
    ctx = setupClient();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(ctx.client.endpoint.call(circular as never)).rejects.toMatchObject({
      code: "bad_request",
      op: "endpoint.call",
    });
    await expect(ctx.client.endpoint.call(10n as never)).rejects.toMatchObject({ code: "bad_request" });
    await expect(ctx.client.sql.run(circular as never)).rejects.toMatchObject({ code: "bad_request", op: "sql.run" });
  });

  it.each([undefined, "GET", "get"])(
    "refuses a body with method %s, since the host refuses a body with GET, before posting",
    async (method) => {
      ctx = setupClient();

      await expect(
        ctx.client.endpoint.call(ANALYSIS_ID, { method: method as "GET" | undefined, body: { setpoint: "22" } })
      ).rejects.toMatchObject({ code: "bad_request", op: "endpoint.call", message: expect.stringMatching(/GET/) });
      expect(ctx.requests()).toHaveLength(0);
    }
  );

  it("drops a query key whose value is undefined, the way JSON drops one from a body", () => {
    ctx = setupClient();
    void ctx.client.endpoint
      .call(ANALYSIS_ID, { query: { device: undefined as unknown as string, room: "4" } })
      .catch(() => undefined);

    expect(ctx.requests()[0].payload).toEqual({ endpoint_id: ANALYSIS_ID, query: { room: "4" } });
  });

  it.each([
    ["null", null],
    ["a Date", new Date("2026-11-23T12:00:00.000Z")],
    ["an object", { id: "a" }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["an array holding an object", [{ id: "a" }]],
    ["an array holding undefined", [undefined]],
  ])("refuses %s as a query value, naming its key, before posting", async (_label, value) => {
    ctx = setupClient();

    await expect(
      ctx.client.endpoint.call(ANALYSIS_ID, { query: { device: value as unknown as string } })
    ).rejects.toMatchObject({ code: "bad_request", op: "endpoint.call", message: expect.stringContaining('"device"') });
    expect(ctx.requests()).toHaveLength(0);
  });

  it("fixes the query when the call is made, even when the call waits for start()", async () => {
    ctx = setupClient();
    ctx.client.stop();
    const query = { room: "4", tags: ["a"] };

    const promise = ctx.client.endpoint.call(ANALYSIS_ID, { query });
    ctx.client.start();
    query.room = "5";
    query.tags.push("b");
    for (let tick = 0; tick < 5 && ctx.requests().length === 0; tick += 1) {
      await Promise.resolve();
    }

    expect(ctx.requests()[0].payload).toEqual({ endpoint_id: ANALYSIS_ID, query: { room: "4", tags: ["a"] } });
    ctx.respondOk({ status: 200, headers: {}, body: "" });
    await promise;
  });
});

describe("endpoint.call headers", () => {
  it("hands out headers without a prototype, keeping a header named after an Object property", async () => {
    ctx = setupClient();
    const promise = ctx.client.endpoint.call(ANALYSIS_ID);

    ctx.respondOk({ status: 200, headers: JSON.parse('{"__proto__":"x","content-type":"text/plain"}'), body: "" });
    const { headers } = await promise;

    expect("constructor" in headers).toBe(false);
    expect(Object.keys(headers).sort()).toEqual(["__proto__", "content-type"]);
    expect(headers.__proto__).toBe("x");
  });
});
