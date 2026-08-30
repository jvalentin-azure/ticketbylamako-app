import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const JWT_REST_NAMESPACE = "jwt-auth/v1";

export const REQUIRED_JWT_REST_ROUTES = [
  { path: "/jwt-auth/v1/token", methods: ["POST"] },
  { path: "/jwt-auth/v1/token/validate", methods: ["POST"] },
] as const;

type JsonRecord = Record<string, unknown>;

export type JwtRestRouteObservation = {
  path: string;
  requiredMethods: string[];
  observedMethods: string[];
};

export type JwtRestRouteGateResult = {
  ok: boolean;
  namespace: string;
  failures: string[];
  requiredRoutes: JwtRestRouteObservation[];
  observedNamespaceRoutes: {
    path: string;
    methods: string[];
  }[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectMethods(value: unknown, destination: Set<string>): void {
  if (!Array.isArray(value)) return;

  for (const method of value) {
    if (typeof method === "string" && /^[A-Za-z]+$/.test(method)) {
      destination.add(method.toUpperCase());
    }
  }
}

function routeMethods(route: JsonRecord): string[] {
  const methods = new Set<string>();
  collectMethods(route.methods, methods);

  if (Array.isArray(route.endpoints)) {
    for (const endpoint of route.endpoints) {
      if (isRecord(endpoint)) collectMethods(endpoint.methods, methods);
    }
  }

  return [...methods].sort();
}

export function validateJwtRestIndex(payload: unknown): JwtRestRouteGateResult {
  const failures: string[] = [];
  const observations: JwtRestRouteObservation[] = [];

  if (!isRecord(payload)) {
    return {
      ok: false,
      namespace: JWT_REST_NAMESPACE,
      failures: ["REST index must be a JSON object"],
      requiredRoutes: [],
      observedNamespaceRoutes: [],
    };
  }

  const namespaces = payload.namespaces;
  if (
    !Array.isArray(namespaces) ||
    !namespaces.some((namespace) => namespace === JWT_REST_NAMESPACE)
  ) {
    failures.push(`missing namespace ${JWT_REST_NAMESPACE}`);
  }

  if (!isRecord(payload.routes)) {
    failures.push("REST index routes must be an object");
    return {
      ok: false,
      namespace: JWT_REST_NAMESPACE,
      failures,
      requiredRoutes: observations,
      observedNamespaceRoutes: [],
    };
  }

  const observedNamespaceRoutes = Object.entries(payload.routes)
    .filter(
      (entry): entry is [string, JsonRecord] =>
        isRecord(entry[1]) && entry[1].namespace === JWT_REST_NAMESPACE,
    )
    .map(([routePath, route]) => ({
      path: routePath,
      methods: routeMethods(route),
    }))
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );

  for (const requirement of REQUIRED_JWT_REST_ROUTES) {
    const route = payload.routes[requirement.path];
    if (!isRecord(route)) {
      failures.push(`missing route ${requirement.path}`);
      observations.push({
        path: requirement.path,
        requiredMethods: [...requirement.methods],
        observedMethods: [],
      });
      continue;
    }

    const observedMethods = routeMethods(route);
    observations.push({
      path: requirement.path,
      requiredMethods: [...requirement.methods],
      observedMethods,
    });

    if (route.namespace !== JWT_REST_NAMESPACE) {
      failures.push(
        `route ${requirement.path} has invalid namespace ${String(route.namespace)}`,
      );
    }

    for (const method of requirement.methods) {
      if (!observedMethods.includes(method)) {
        failures.push(`route ${requirement.path} is missing method ${method}`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    namespace: JWT_REST_NAMESPACE,
    failures,
    requiredRoutes: observations,
    observedNamespaceRoutes,
  };
}

export function formatJwtRestRouteGateResult(
  result: JwtRestRouteGateResult,
): string {
  const requiredRoutes = result.requiredRoutes
    .map((route) => `${route.path}:${route.requiredMethods.join(",")}`)
    .join(" ");
  const inventory = JSON.stringify(result.observedNamespaceRoutes);

  if (!result.ok) {
    return `FAIL ${result.failures.join("; ")} observed_routes=${inventory}`;
  }

  return `PASS namespace=${result.namespace} required_routes=${result.requiredRoutes.length} ${requiredRoutes} observed_routes=${inventory}`;
}

async function readInput(inputPath: string): Promise<unknown> {
  const source =
    inputPath === "-"
      ? await new Promise<string>((resolve, reject) => {
          let contents = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", (chunk: string) => {
            contents += chunk;
          });
          process.stdin.on("end", () => resolve(contents));
          process.stdin.on("error", reject);
        })
      : await readFile(inputPath, "utf8");

  return JSON.parse(source) as unknown;
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error(
      "Usage: tsx scripts/validate-jwt-rest-routes.ts <rest-index.json|->",
    );
  }

  const result = validateJwtRestIndex(await readInput(inputPath));
  const output = formatJwtRestRouteGateResult(result);
  (result.ok ? process.stdout : process.stderr).write(`${output}\n`);
  if (!result.ok) process.exitCode = 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (import.meta.url === entryPoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`FAIL ${message}\n`);
    process.exitCode = 1;
  });
}
