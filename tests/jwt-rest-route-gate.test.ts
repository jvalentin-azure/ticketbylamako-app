import { describe, expect, it } from "vitest";

import {
  formatJwtRestRouteGateResult,
  validateJwtRestIndex,
} from "../scripts/validate-jwt-rest-routes";

type Route = {
  namespace: string;
  methods?: string[];
  endpoints?: { methods: string[] }[];
};

function requiredRoutes(): Record<string, Route> {
  return {
    "/jwt-auth/v1/token": {
      namespace: "jwt-auth/v1",
      methods: ["POST"],
    },
    "/jwt-auth/v1/token/validate": {
      namespace: "jwt-auth/v1",
      methods: ["POST"],
    },
  };
}

function restIndex(extraRouteCount = 0) {
  const routes = requiredRoutes();
  for (let index = 0; index < extraRouteCount; index += 1) {
    routes[`/jwt-auth/v1/admin/optional-${index}`] = {
      namespace: "jwt-auth/v1",
      methods: ["GET"],
    };
  }

  return {
    namespaces: ["wp/v2", "jwt-auth/v1"],
    routes,
  };
}

describe("JWT REST semantic release gate", () => {
  it("accepts the required namespace, login and validation contracts", () => {
    const result = validateJwtRestIndex(restIndex());

    expect(result.ok).toBe(true);
    expect(result.failures).toEqual([]);
    expect(formatJwtRestRouteGateResult(result)).toContain("required_routes=2");
  });

  it("accepts both the historical 14-route and current 11-route inventories", () => {
    const historical = restIndex(12);
    const current = restIndex(9);

    expect(Object.keys(historical.routes)).toHaveLength(14);
    expect(Object.keys(current.routes)).toHaveLength(11);
    expect(validateJwtRestIndex(historical).ok).toBe(true);
    expect(validateJwtRestIndex(current).ok).toBe(true);
  });

  it("does not require the namespace index route when the namespace is discoverable", () => {
    const result = validateJwtRestIndex(restIndex());

    expect(result.ok).toBe(true);
    expect(
      result.observedNamespaceRoutes.map((route) => route.path),
    ).not.toContain("/jwt-auth/v1");
  });

  it("reports a deterministic inventory of every observed namespace route", () => {
    const payload = restIndex();
    payload.routes["/jwt-auth/v1/z-admin"] = {
      namespace: "jwt-auth/v1",
      methods: ["post", "GET"],
    };
    payload.routes["/jwt-auth/v1/a-admin"] = {
      namespace: "jwt-auth/v1",
      endpoints: [{ methods: ["DELETE", "get"] }],
    };
    payload.routes["/other/v1/ignored"] = {
      namespace: "other/v1",
      methods: ["GET"],
    };

    const result = validateJwtRestIndex(payload);
    expect(result.observedNamespaceRoutes).toEqual([
      { path: "/jwt-auth/v1/a-admin", methods: ["DELETE", "GET"] },
      { path: "/jwt-auth/v1/token", methods: ["POST"] },
      { path: "/jwt-auth/v1/token/validate", methods: ["POST"] },
      { path: "/jwt-auth/v1/z-admin", methods: ["GET", "POST"] },
    ]);
    expect(formatJwtRestRouteGateResult(result)).toContain(
      `observed_routes=${JSON.stringify(result.observedNamespaceRoutes)}`,
    );
  });

  it("accepts methods declared by WordPress endpoint metadata", () => {
    const payload = restIndex();
    payload.routes["/jwt-auth/v1/token"].methods = undefined;
    payload.routes["/jwt-auth/v1/token"].endpoints = [{ methods: ["post"] }];

    expect(validateJwtRestIndex(payload).ok).toBe(true);
  });

  it("fails closed when a required route is absent", () => {
    const payload = restIndex();
    delete payload.routes["/jwt-auth/v1/token/validate"];

    const result = validateJwtRestIndex(payload);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      "missing route /jwt-auth/v1/token/validate",
    );
  });

  it("fails closed when a required method is absent", () => {
    const payload = restIndex();
    payload.routes["/jwt-auth/v1/token"].methods = ["GET"];

    const result = validateJwtRestIndex(payload);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      "route /jwt-auth/v1/token is missing method POST",
    );
    expect(formatJwtRestRouteGateResult(result)).toContain("observed_routes=");
  });

  it("fails closed when namespace discovery is missing", () => {
    const payload = restIndex();
    payload.namespaces = ["wp/v2"];

    const result = validateJwtRestIndex(payload);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain("missing namespace jwt-auth/v1");
  });

  it("fails closed when a route claims a different namespace", () => {
    const payload = restIndex();
    payload.routes["/jwt-auth/v1/token"].namespace = "other/v1";

    const result = validateJwtRestIndex(payload);
    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      "route /jwt-auth/v1/token has invalid namespace other/v1",
    );
  });

  it("fails closed on malformed REST indexes", () => {
    expect(validateJwtRestIndex(null)).toMatchObject({ ok: false });
    expect(
      validateJwtRestIndex({ namespaces: ["jwt-auth/v1"], routes: [] }),
    ).toMatchObject({ ok: false });
  });
});
