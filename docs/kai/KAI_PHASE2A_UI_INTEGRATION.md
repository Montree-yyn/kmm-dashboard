# KAI Phase 2A UI Integration

Status: `KAI_PHASE2A_UI_INTEGRATION_COMPLETE`

## Problem found in browser testing

The existing KAI panel called `/api/kai/chat` for every message. The Phase 2A Runtime Query Engine was available at `/api/kai/query`, but the panel did not call it. As a result, supported questions such as `เดือนนี้จองเท่าไหร่` and `Stock เกิน 90 วันมีรุ่นอะไรบ้าง` missed the Knowledge Layer and fell through to the legacy AI/web-search path.

## Fix

`lib/kai/client.ts` now calls the authenticated, company-scoped `/api/kai/query` endpoint first.

- A successful runtime result is shown directly in the existing KAI panel as a deterministic read-only answer.
- A `422 unsupported_question` result falls back to the existing `/api/kai/chat` behavior for general questions.
- Authentication, access, database, and Knowledge Layer failures are surfaced instead of being hidden behind a generic AI answer.
- No new Chat UI, LLM behavior, production deployment, or database mutation was added.

## Validation

- Supported runtime cases: `5/5 PASS`
- Phase 2A focused suite including UI routing assertion: `6/6 PASS`
- Phase 1E focused suite: `11/11 PASS`
- Build and TypeScript: `PASS`
- Existing regression suite: `288/288 PASS`

Authenticated Safari smoke test: `5/5 PASS` through the existing KAI panel. The endpoint also correctly rejects unauthenticated requests with `401`, as required by the existing access boundary.
