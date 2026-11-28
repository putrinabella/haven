import "server-only";
import { z } from "zod";
import { getUser } from "./auth";
import {
  AppError,
  PayloadTooLargeError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "./errors";
import {
  MAX_BODY_BYTES,
  clientIp,
  errorBody,
  isSameOrigin,
  isUnsafeMethod,
  okBody,
  paginationMeta,
} from "./http-core";
import { consumeRateLimit, type RateLimitConfig } from "./rate-limit";
import { HOUSEHOLD_COOKIE, HOUSEHOLD_HEADER, readCookie, type HouseholdRole } from "./tenancy-core";
import { requireRole, resolveHousehold, type HouseholdContext } from "./tenancy";

type AuthMode = "public" | "user" | "household";
type Infer<S> = S extends z.ZodType ? z.infer<S> : undefined;
type AuthedUser = NonNullable<Awaited<ReturnType<typeof getUser>>>;

export const DEFAULT_ROUTE_RATE_LIMIT: RateLimitConfig = { limit: 120, windowSeconds: 60 };
export const DEFAULT_PUBLIC_RATE_LIMIT: RateLimitConfig = { limit: 30, windowSeconds: 60 };

interface RouteOptions<
  Q extends z.ZodType | undefined,
  B extends z.ZodType | undefined,
  P extends z.ZodType | undefined,
  A extends AuthMode,
> {
  /** Stable name; namespaces the rate-limit bucket and appears in server logs. */
  name: string;
  /** "user" (default): signed in. "household": signed in + active household + role. "public": no auth. */
  auth?: A;
  /** auth "household" only. Defaults to "member". */
  minRole?: HouseholdRole;
  params?: P;
  query?: Q;
  body?: B;
  /** Defaults: 120/min per user, 30/min per IP for public routes. `false` opts out explicitly. */
  rateLimit?: RateLimitConfig | false;
}

export interface RouteArgs<
  Q extends z.ZodType | undefined,
  B extends z.ZodType | undefined,
  P extends z.ZodType | undefined,
  A extends AuthMode,
> {
  request: Request;
  requestId: string;
  user: A extends "public" ? null : AuthedUser;
  household: A extends "household" ? HouseholdContext : null;
  params: Infer<P>;
  query: Infer<Q>;
  body: Infer<B>;
}

/** What a handler returns when it needs a non-200 status or extra headers. A plain value means 200. */
export class Reply<T> {
  constructor(
    readonly data: T,
    readonly init: { status?: number; headers?: HeadersInit; message?: string } = {},
  ) {}
}
export const reply = <T>(data: T, init?: Reply<T>["init"]) => new Reply(data, init);
export const created = <T>(data: T) => new Reply(data, { status: 201, message: "Created" });
export const noContent = () => new Reply(null, { status: 204 });
export const paginated = <T>(items: T[], total: number, page: number, size: number) =>
  new Reply({ items, meta: paginationMeta(total, page, size) });

type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

function respond(body: unknown, status: number, requestId: string, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("x-request-id", requestId);
  h.set("cache-control", "no-store"); // API data is per-user: never let a CDN or browser reuse it
  if (status === 204) return new Response(null, { status, headers: h });
  return Response.json(body, { status, headers: h });
}

function toErrorResponse(e: unknown, name: string, requestId: string): Response {
  if (e instanceof AppError) {
    const headers = e instanceof RateLimitedError ? { "retry-after": String(e.retryAfterSeconds) } : undefined;
    return respond(errorBody(e.status, e.code, e.message, requestId, e.fieldErrors), e.status, requestId, headers);
  }
  // A bug or an infrastructure failure: full detail stays server-side, the client gets a generic
  // message plus the request id so support can find the log line.
  console.error("[route]", name, requestId, e);
  return respond(errorBody(500, "internal_error", "Something went wrong", requestId), 500, requestId);
}

function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid request", z.flattenError(result.error).fieldErrors as Record<string, string[]>);
  }
  return result.data;
}

/**
 * The ONLY sanctioned way to write a route handler under src/app/api/v1. One pipeline, always in
 * this order: CSRF origin check -> authenticate -> rate limit -> household + role -> validate
 * params/query/body -> handler -> uniform envelope. Errors never leak internals.
 *
 *   export const GET = defineRoute({ name: "things.list", auth: "household", query: listQuerySchema },
 *     async ({ household, query }) => paginated(rows, total, query.page, query.size));
 *
 * Authentication today is the first-party session cookie. To let third parties build their own
 * front end, add a second authenticator here (API key / bearer token) in `authenticate()`; routes
 * and handlers do not change. Cross-origin browser access (CORS) is intentionally NOT enabled.
 */
export function defineRoute<
  Q extends z.ZodType | undefined = undefined,
  B extends z.ZodType | undefined = undefined,
  P extends z.ZodType | undefined = undefined,
  A extends AuthMode = "user",
>(
  options: RouteOptions<Q, B, P, A>,
  handler: (args: RouteArgs<Q, B, P, A>) => Promise<Reply<unknown> | Response | unknown>,
) {
  const auth: AuthMode = options.auth ?? "user";

  return async (request: Request, context?: RouteContext): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      // 1. CSRF: cookie-authenticated, state-changing requests must come from our own origin.
      if (auth !== "public" && isUnsafeMethod(request.method) && !isSameOrigin(request.headers)) {
        throw new AppError(403, "bad_origin", "Cross-origin request blocked");
      }

      // 2. Authenticate.
      const user = auth === "public" ? null : await getUser();
      if (auth !== "public" && !user) throw new UnauthorizedError();

      // 3. Rate limit (shared Postgres store; per user, or per IP when anonymous).
      const limit =
        options.rateLimit === undefined
          ? auth === "public"
            ? DEFAULT_PUBLIC_RATE_LIMIT
            : DEFAULT_ROUTE_RATE_LIMIT
          : options.rateLimit;
      if (limit) {
        const subject = user ? `u:${user.id}` : `ip:${clientIp(request.headers)}`;
        const result = await consumeRateLimit(`route:${options.name}`, subject, limit);
        if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
      }

      // 4. Household + role. An explicit X-Household-Id header is strict (403 if not a member);
      //    the cookie is a convenience and falls back to the oldest membership when stale.
      let household: HouseholdContext | null = null;
      if (auth === "household" && user) {
        const header = request.headers.get(HOUSEHOLD_HEADER);
        household = await resolveHousehold(user.id, {
          requestedId: header ?? readCookie(request.headers.get("cookie"), HOUSEHOLD_COOKIE),
          strict: header !== null,
        });
        requireRole(household, options.minRole ?? "member");
      }

      // 5. Validate.
      const url = new URL(request.url);
      const params = options.params ? parseWith(options.params, context ? await context.params : {}) : undefined;
      const query = options.query ? parseWith(options.query, Object.fromEntries(url.searchParams)) : undefined;
      let body: unknown;
      if (options.body) {
        const type = request.headers.get("content-type") ?? "";
        if (!type.toLowerCase().startsWith("application/json")) {
          throw new AppError(415, "unsupported_media_type", "Content-Type must be application/json");
        }
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) throw new PayloadTooLargeError();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new AppError(400, "invalid_json", "Request body is not valid JSON");
        }
        body = parseWith(options.body, json);
      }

      // 6. Run and wrap.
      const result = await handler({
        request,
        requestId,
        user,
        household,
        params,
        query,
        body,
      } as unknown as RouteArgs<Q, B, P, A>);

      if (result instanceof Response) return result;
      if (result instanceof Reply) {
        const status = result.init.status ?? 200;
        return respond(okBody(result.data, requestId, status, result.init.message), status, requestId, result.init.headers);
      }
      return respond(okBody(result, requestId), 200, requestId);
    } catch (e) {
      return toErrorResponse(e, options.name, requestId);
    }
  };
}
