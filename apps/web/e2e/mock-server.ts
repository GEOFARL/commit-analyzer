import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

export const MOCK_PORT = 54321;
export const MOCK_ACCESS_TOKEN = "mock-access-token";

const MOCK_USER = {
  id: "test-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  email_confirmed_at: "2024-01-01T00:00:00Z",
  user_metadata: { full_name: "Test User", avatar_url: null },
  app_metadata: { provider: "github" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

// Pre-populated so the bypass path (page.route interception) works without
// going through the real token-exchange endpoint.
const validTokens = new Set<string>([MOCK_ACCESS_TOKEN]);
let server: Server | null = null;

function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${MOCK_PORT}`);
  const { pathname, searchParams } = url;

  // POST /auth/v1/token?grant_type=pkce — exchange code for session
  if (
    req.method === "POST" &&
    pathname === "/auth/v1/token" &&
    searchParams.get("grant_type") === "pkce"
  ) {
    validTokens.add(MOCK_ACCESS_TOKEN);
    const session = {
      access_token: MOCK_ACCESS_TOKEN,
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: "bearer",
      user: MOCK_USER,
    };
    req.resume(); // drain body
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(session));
    return;
  }

  // GET /auth/v1/user — return mock user when token is valid
  if (req.method === "GET" && pathname === "/auth/v1/user") {
    const auth = req.headers.authorization ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token && validTokens.has(token)) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(MOCK_USER));
    } else {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "not authenticated" }));
    }
    return;
  }

  // POST /auth/sync — API auth sync (always 200)
  if (req.method === "POST" && pathname === "/auth/sync") {
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /auth/sign-in-event — always 200
  if (req.method === "POST" && pathname === "/auth/sign-in-event") {
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
}

export function startMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server = createServer(handleRequest);
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
}

export function stopMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }
    server.close((err) => {
      server = null;
      if (err) reject(err);
      else resolve();
    });
  });
}
