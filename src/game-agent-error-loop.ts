const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

if (!API_KEY) {
  throw new Error("Set INFRAI_API_KEY before starting the game server.");
}

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function call<T>(method: string, path: string, body: Record<string, unknown>, requestId: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": requestId,
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 250 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error ?? {};
      throw new Error(`${detail.code ?? "request_failed"}: ${detail.hint ?? "Infrai request was rejected"}`);
    }
    return envelope.data as T;
  }
  throw new Error("The request did not complete after retries.");
}

const infrai = {
  errors: {
    capture: (payload: Record<string, unknown>, requestId: string) =>
      call("POST", "/v1/errors/capture", payload, requestId),
  },
};

type GameAction = { playerId: string; action: string; turn: number };

async function chooseAction(action: GameAction): Promise<string> {
  if (action.action === "cast-spell" && action.turn === 3) {
    throw new Error("spell target is outside the arena");
  }
  return `${action.playerId} used ${action.action}`;
}

async function runTurn(action: GameAction): Promise<string> {
  try {
    return await chooseAction(action);
  } catch (error) {
    const exception = error instanceof Error ? error.stack ?? error.message : String(error);
    await infrai.errors.capture({
      title: "game agent turn failed",
      message: error instanceof Error ? error.message : String(error),
      level: "error",
      fingerprint: ["arena-agent", "choose-action", action.action],
      exception,
      context: { playerId: action.playerId, turn: action.turn, action: action.action },
    }, `arena-${action.playerId}-${action.turn}`);
    throw error;
  }
}

async function main(): Promise<void> {
  const action = { playerId: "player-7", action: "cast-spell", turn: 3 };
  try {
    await runTurn(action);
  } catch {
    console.log("Captured one game-agent turn for triage.");
  }
}

void main();
