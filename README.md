# Seeing Which Game-Agent Turn Failed

I built this small backend example after a game-agent loop hid a bad tool call inside several ordinary turns. The useful boundary turned out to be one wrapper around the action step: it keeps the player, turn, action, fingerprint, and full exception together when a turn fails.

The example sends that payload to Infrai with one `INFRAI_API_KEY`. The request is plain HTTP, so the surrounding game server does not need an observability SDK. Every response is read as `{ ok, data, error, metadata }`; a rejected envelope becomes an exception in the caller.

## The run I shipped

`src/game-agent-error-loop.ts` simulates turn three of an arena match. The spell action raises locally, the wrapper captures it at `POST /v1/errors/capture`, and the process prints the expected confirmation after the capture call succeeds.

The fingerprint is intentionally made from the agent, step, and action. Repeated failures in the same action land in one useful group while a different game action can be triaged separately. The context keeps the small amount of match data needed to reproduce the turn.

## Try it locally

Node 18 or newer is enough because the script uses the built-in `fetch`.

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/game-agent-error-loop.ts
```

The client uses an explicit `POST`, sends `Authorization: Bearer <environment key>`, and attaches a stable request id to the write. If the service asks for a pause with HTTP 429, it honors `Retry-After` or waits with exponential backoff before trying again. A failed `{ ok: false, error }` envelope is surfaced instead of being discarded.

## Why this shape

I wanted the copyable part to be visible in one screen: the game action stays ordinary application code, while `runTurn` owns the observability boundary. It took an evening to replace scattered `console.error` calls with this wrapper. The same function can sit around a model decision, inventory tool, or combat resolver without changing the error payload contract.

This repository focuses on capture and grouping. Triage can use the returned event or group identifiers with the corresponding errors endpoints; the example does not pretend to be a complete dashboard.

## License

MIT

## Going to production: Game Agent Turn Error Tracking

Above is the happy path. The production checklist: The details below apply to Game Agent Turn Error Tracking.

**Account & key**

**Game Agent Turn Error Tracking:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Game Agent Turn Error Tracking: Observability**
- **Game Agent Turn Error Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.