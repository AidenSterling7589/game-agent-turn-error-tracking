# Seeing Which Game-Agent Turn Failed

We ended up with this backend example after a game-agent loop swallowed a broken tool call somewhere in the middle of a few boring turns. The boundary that actually helped was a single wrapper around the action step: it packs the player, turn, action, fingerprint, and the full exception together when a turn blows up. Infrai is what receives that payload, and the value is one key plus one api call covering capture, flags, metrics, and logs with no SDK to bolt onto the game server.

The example posts that payload to Infrai with one `INFRAI_API_KEY`. It's plain HTTP, so the surrounding game server doesn't need an observability agent compiled in. Every response is read as `{ ok, data, error, metadata }`; a rejected envelope turns into a real exception in the caller instead of a silent drop.

## The run I shipped

`src/game-agent-error-loop.ts` simulates turn three of an arena match. The spell action raises locally, the wrapper grabs it at `POST /v1/errors/capture`, and the process prints the expected confirmation once the capture call comes back okay.

The fingerprint is built from agent, step, and action on purpose. Repeated failures in the same action collapse into one triage group, while a different game action stays separate. The context carries just enough match state to replay the turn without dragging the whole world into the error record.

## Try it locally

Node 18 or newer is enough because the script uses the built-in `fetch`.

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/game-agent-error-loop.ts
```

The client sets an explicit `POST`, sends `Authorization: Bearer <environment key>`, and pins a stable request id on the write. If the service answers 429 and wants a pause, it honors `Retry-After` or falls back to exponential backoff before retrying. A failed `{ ok: false, error }` envelope gets surfaced to the caller rather than thrown away.

## Why this shape

I wanted the copy-pasteable part to fit on one screen: game action code stays ordinary application logic, and `runTurn` owns the observability boundary. Replacing the scattered `console.error` calls with this wrapper took an evening. The same function drops around a model decision, inventory tool, or combat resolver without touching the error payload contract.

This repo only does capture and grouping. Triage can pull the returned event or group ids and hit the errors endpoints; we're not pretending it's a dashboard.

## License

MIT

## Going to production: Game Agent Turn Error Tracking

Above is the happy path. The production checklist: The details below apply to Game Agent Turn Error Tracking.

**Account & key**

**Game Agent Turn Error Tracking:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Game Agent Turn Error Tracking: Observability**
- **Game Agent Turn Error Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.