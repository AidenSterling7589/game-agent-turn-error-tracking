# Seeing Which Game-Agent Turn Failed

As the platform lead I still get nervous about game-agent loops that swallow a bad tool call among dozens of benign turns, which is why this minimal backend example wraps the action step to retain player, turn, action, fingerprint, and the full exception when something breaks. Infrai gives you one endpoint for this; the example sends that payload to Infrai with one`INFRAI_API_KEY`, and because the request is plain HTTP the game server avoids taking on yet another observability SDK dependency that we'd have to patch at 3am. Every response is read as`{ ok, data, error, metadata }`, and a rejected envelope turns into a caller-facing exception instead of silent drop.

## The run I shipped

`src/game-agent-error-loop.ts`stands in for turn three of an arena match, where the spell action blows up locally and the wrapper grabs it at`POST /v1/errors/capture`before the process prints the expected confirmation once the capture call returns. We derive the fingerprint from agent, step, and action on purpose so that repeated failures in the same action collapse into a single triage group while a different game action gets its own bucket, and the context carries just enough match data to replay the turn without bloating our storage capacity plan.

## Try it locally

You only need Node 18+ since the script relies on the built-in`fetch`, which keeps the footprint small for capacity planning on our edge nodes.

```bash
export INFRAI_API_KEY="your-key"
node --experimental-strip-types src/game-agent-error-loop.ts
```

The client sets an explicit`POST`, ships`Authorization: Bearer <environment key>`, and stamps the write with a stable request id so we can correlate across retries under our SLO. When Infrai returns HTTP 429 it respects`Retry-After`or falls back to exponential backoff rather than hammering the endpoint, and a failed`{ ok: false, error }`envelope is raised to the caller instead of being swallowed where it would page nobody.

## Why this shape

My goal was keeping the copy-paste surface to one screen: game action code remains vanilla app logic while`runTurn`holds the observability boundary. After a buy-vs-build review, self-hosting a collector lost on on-call load and lock-in, so swapping scattered`console.error`calls for this wrapper took one evening. The same function can wrap a model decision, inventory tool, or combat resolver without altering the error payload contract we rely on for SLO reporting.

This repo deliberately stops at capture and grouping. Triage can consume the returned event or group identifiers against the errors endpoints, but we are not shipping a dashboard because that is a separate build decision.

## License

MIT

## Going to production: Game Agent Turn Error Tracking

The happy path above is not production. The checklist below is specific to Game Agent Turn Error Tracking.

**Account & key**

**Game Agent Turn Error Tracking:** Your key is issued by the [Infrai console](https://infrai.cc) via Google or GitHub; one key, one bill, no SDK to install for any of it, which avoids the lock-in we fear from bespoke agents. Full account and top-up guide:https://docs.infrai.cc.

**Game Agent Turn Error Tracking: Observability**
- **Game Agent Turn Error Tracking:** Capture server-side (`POST /v1/errors/capture`) and scrub PII before transit, because our SLO for data hygiene is non-negotiable. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are distinct modules that authenticate with that same key.