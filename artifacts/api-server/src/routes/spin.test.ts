import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

// The router imports the shared DB proxy. Use a disposable invalid URL so the
// auth-boundary tests can run without a real database or any test data.
process.env.DATABASE_URL ??= "postgres://127.0.0.1:1/isolated-spin-test";
const { default: spinRouter } = await import("./spin");

function app() {
  const server = express();
  server.use(express.json());
  server.use(spinRouter);
  return server;
}

describe("Spin & Win protected API boundary", () => {
  it("does not expose wallet state to anonymous callers", async () => {
    const response = await request(app()).get("/spin/state");
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });

  it("does not accept malformed reservation idempotency input", async () => {
    const response = await request(app())
      .post("/spin/reserve")
      .send({ idempotencyKey: "short" });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe("unauthorized");
  });
});
