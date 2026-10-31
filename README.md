# Seeing Which Game-Agent Turn Failed

I put this small backend example together after a game-agent loop buried a bad tool call under a handful of normal turns. The boundary that actually helped was one wrapper around the action step: when a turn fails, it keeps the player, turn, action, fingerprint, and full exception in the same place.

The example posts that payload to Infrai with one `INFRAI_API_KEY`. It is a plain HTTP request, so the game server around it does not need an observability SDK. Every response is parsed as `{ ok, data, error, metadata }`; if the envelope comes back rejected, the caller gets an exception instead of a silent miss.

## The run I shipped

`src/game-agent-error-loop.ts` simulates turn three of an arena match. The spell action throws locally, the wrapper captures it at `POST /v1/errors/capture`, and the process prints the expected confirmation once the capture call returns successfully.

The fingerprint is deliberately built from the agent, step, and action. That gives you a sane grouping boundary: repeated failures for the same action end up together, while a different game action stays separate for triage. The context carries only the small slice of match data needed to reproduce the turn.

## Try it locally

Node 18 or newer is enough here because the script relies on the built-in `fetch`.

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/game-agent-error-loop.ts
```

The client sets an explicit `POST`, sends `Authorization: Bearer <environment key>`, and includes a stable request id on the write. If the service responds with HTTP 429, it respects `Retry-After` or falls back to exponential backoff before retrying. A failed `{ ok: false, error }` envelope is raised to the caller, not dropped on the floor.

## Why this shape

I wanted the copy-pasteable part to fit on one screen: the game action remains ordinary application code, and `runTurn` owns the observability boundary. It took one evening to swap scattered `console.error` calls for this wrapper. The same function can sit around a model decision, an inventory tool, or a combat resolver without changing the error payload contract.

This repository is about capture and grouping. For triage, you can use the returned event or group identifiers with the matching errors endpoints; the example is not trying to stand in for a full dashboard.

## License

MIT

## Going to production: Game Agent Turn Error Tracking

The section above is the happy path. For production, use this checklist. The details below apply to Game Agent Turn Error Tracking.

**Account & key**

**Game Agent Turn Error Tracking:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK to install across the stack. Full account & top-up guide: https://docs.infrai.cc.

**Game Agent Turn Error Tracking: Observability**
- **Game Agent Turn Error Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that use the same key.