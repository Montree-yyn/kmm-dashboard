# Crop Calendar — Local Visual UAT & UI Bug Audit

**Date:** 2026-08-15 · **Scope:** `src/modules/agriculture/AgricultureCalendar.tsx` + `agriculture.calendar-view.ts` + related cards/drawer
**Method:** Real component rendered in a self-contained harness (`artifacts/crop-calendar-preview/preview.html`) with **real payloads from the local D1** (5 scopes: ALL / Bago Region / Nattalin / Lower Myanmar / Mudon), driven at real viewport widths 1024 / 768 / 390 / 375 via a scaled iframe (Tailwind breakpoints + `.kmm-kai-panel` evaluate truthfully). Programmatic DOM-geometry audit (alignment, overflow, rects, contrast) + interactive tests (drawer open/close, toggle, about, export).
**Constraint honored:** audit only — **no code changed in this round**.

> Note on method: the preview webview compositor failed after the first screenshot (environment limitation), so pixel-level screenshot review was replaced by exact DOM-geometry measurement (equal or better precision). `preview.html` remains available in the Preview tab for human visual confirmation.

---

## VISUAL_UAT_STATUS: LIMITED (geometry-verified; 1 screenshot early, then compositor failed)
## DESKTOP_STATUS: PASS · TABLET_STATUS: PASS · MOBILE_STATUS: PASS (interaction-verified at 375/390/768/1024)

| Area | Result | Evidence |
|---|---|---|
| 12-month grid | ✅ 12 columns, 64px each, evenly spaced | `monthRects` cx: 233→297→361→425 (Δ64) |
| Current-month marker | ✅ aligned to ส.ค. 2026, `markerDelta = 0` | auto-audit measure |
| Stage bars ↔ month columns | ✅ pixel-perfect (`dx=0`, `dxR=0` for all sampled bars) | bar rects vs grid columns |
| Page-level horizontal overflow | ✅ none at 340/375/390/768/1024 | `bodyScrollW − viewportW = 0` everywhere |
| Timeline scroll | ✅ internal scroll (min-w 948px) at <1024 | scrollWidth 948 vs clientWidth 306–726 |
| Situation cards | ✅ snap-scroll <1024 / grid ≥1024 | class `lg:grid lg:grid-cols-2` |
| Detail drawer | ✅ desktop right-panel 420px; mobile bottom sheet full-width 80dvh | rects at 1024 (x604,w420) vs 375 (x0,y164,h656) |
| Drawer close | ✅ X + backdrop both close | direct click tests |
| Main-crops toggle | ✅ filters 23→8 rows | row count before/after |
| About-data toggle | ✅ expands explanation | text check |
| CSV export | ✅ click executes without error | button click + console clean |
| Console errors | ✅ none | `preview_logs` empty |

---

## DATA TRUST

- ✅ Regional vs township vs historical distinguished by **badge + tone + text** (not color alone): `ข้อมูลอ้างอิง` / `ข้อมูลย้อนหลัง` / `สืบทอดจากระดับบน` / `รอการยืนยัน` / `ไม่มีข้อมูล`.
- ✅ No fabricated bars: groups without months are excluded from the timeline; no-data states render empty-state cards (`ไม่มีข้อมูลพื้นที่ที่เชื่อถือได้`, `ไม่มีข้อมูลรายพื้นที่ในขอบเขตนี้`).
- ✅ Donut is honest about provenance: `CSO 9.12 · 2023` (Bago) vs `ข้อมูลจริงระดับ Township · 2024` (ALL/Mudon/Nattalin); `>` qualifier shown on MORE_THAN values; Lower Myanmar correctly shows **no-data** (no statistics exist).
- ✅ `อีก 2 เดือนถึงช่วงเก็บเกี่ยว · ต.ค.–ธ.ค.` verified against data (SOWING 5–6, HARVEST 10–12, now Aug → Δ2). Correct.
- ⚠️ **Two data-trust defects found — see BUGS P1-2 and P2-4.**

---

## BUGS_FOUND

### P0
- (none)

### P1
1. **Planning-scope season label is incoherent — mixes reference-source years with planning years.**
   - UI: breadcrumb shows `2000/27` (Bago/Nattalin), `2024/27` (Mudon), `2007/08` (Lower Myanmar) instead of a planning season like `2026/27`.
   - Evidence: `agriculture.calendar-view.ts` `planningScope()` — `season = ${min(years)}/${(max+1)%100}` over **all** rows' `cropYear`/`validFromYear`; real D1 rows `calendar-phase3-bago-rice-main-*` carry `valid_from_year = 2000` (FAO document published 2000-10) while rubber rows carry 2026.
   - Impact: an executive reading the breadcrumb sees "2000/27" and cannot tell the planning year; breaks the "planning scope in seconds" goal and looks like broken software.
   - Root cause: source-reference year (2000/2007) and planning/crop year (2024/2025/2026) are conflated in one min–max label.
   - Fix direction: derive the label from the **planning/crop year** only (e.g. max cropYear → `2026/27`), or if multi-source years are intended, label explicitly `อ้างอิงหลายปี 2000–2026` (a `seasonReference` copy key already exists, unused).

2. **Drawer verification line "V4 · ข้อมูลปัจจุบันที่ยืนยันแล้ว" contradicts reference status (TH only).**
   - UI: regional-reference rows (FAO 2000) show `สถานะการยืนยัน: V4 · ข้อมูลปัจจุบันที่ยืนยันแล้ว` ("current verified data") directly below a header badge `รัฐ/ภูมิภาค · ข้อมูลอ้างอิง`.
   - Evidence: `agriculture.ui.ts` `agricultureVerificationLevelLabel()` maps `V4 → "ข้อมูลปัจจุบันที่ยืนยันแล้ว"`; consumed by `DetailDrawer`.
   - Impact: exactly the failure the spec forbids — a regional reference reads as current field observation. EN is unaffected (`V4` only).
   - Fix direction: in the drawer, compose the verification line from the evidence badge (e.g. `V4 · ข้อมูลอ้างอิงที่ยืนยันแล้ว`) instead of the raw V-level label; keep the "current" wording strictly for `CURRENT_OBSERVED`/field-verified rows.

### P2
3. **Contrast failure: `--text-tertiary` (#9ca3af) on white = 2.54:1 (needs 4.5:1 for AA).**
   - Used for small secondary text throughout the redesign (season labels, `ช่วงโดยทั่วไป · ข้อมูลอ้างอิง`, footers, sources meta).
   - Pre-existing design token, but the redesign leans on it heavily. Fix direction: darken the token (e.g. #6b7280 ≈ 4.8:1) or use `--text-secondary` for these spots. (`--text-primary` 14.7:1 ✓, brand-green `#47763d` on pale 4.87:1 ✓.)

4. **Donut percentages rendered as exact when derived from MORE_THAN lower bounds.**
   - UI: Mudon `ข้าว 100% >75,000`, ALL `ข้าว 90.9% >75,000`. The value shows `>` but the percent doesn't, implying precision that doesn't exist.
   - Evidence: `agriculture.calendar-view.ts` `buildDonut()` computes `percent = value/total` without qualifier; `AreaCard` prints `{percent}%`.
   - Fix direction: when `segment.moreThan` (or `donut.moreThan`), render `≈`/`>` before the percent or add a caption `ค่าขั้นต่ำ — เปอร์เซ็นต์โดยประมาณ`.

5. **Related-areas table header is a bare "V".**
   - UI: 4th column header renders just `V` (rows show `V1`).
   - Evidence: `AgricultureCalendar.tsx` `RelatedAreasCard` `<th>V</th>`.
   - Fix direction: use a copy key (e.g. `ระดับการยืนยัน` / `Verification`); bonus: it's a hardcoded label, not localized.

### P3
6. **Small touch targets:** drawer close `size-9` (36px), situation-card chevron row — below the 44px recommendation (borderline, not blocking).
7. **Situation cards `min-w-[240px]` truncate long crop/season names** at narrow widths — Thai "Main monsoon" fits today; long localized season strings would ellipsize.
8. **"ช่วงกลางฤดู" (Mid-cycle) badge** is window-derived (between planting-end and harvest-start), not a recorded growth stage. Honest and footnoted, but an evaluator expecting "เจริญเติบโต" (Growth) per the mockup should know the distinction: a real growth stage requires a `GROWTH`-class row or field verification in the data (documented in the redesign report).
9. **Updated-at pill** shows payload `generatedAt` (request-time in real API; fixture timestamp in harness) — correct behavior, noted for clarity.

---

## UX_SCORE: 8/10
Answers the 4 questions in <10s on desktop: crop list (✅), current cycle position via badge + marker (✅, marker aligned), harvest countdown (✅ "อีก X เดือน"), trust level (⚠️ P1-1 season label + P1-2 drawer wording muddy the trust story).

## DATA_TRUST_SCORE: 7/10
Strong foundation (badges/text/icons, no-data honesty, provenance labels, `>` qualifiers) minus P1-2 ("ข้อมูลปัจจุบันที่ยืนยันแล้ว" on a 2000 reference) and P2-4 (percent without qualifier).

## RESPONSIVE_SCORE: 8/10
No overflow at any tested width; timeline, cards, drawer all adapt correctly; interactions verified at 375/768/1024. Deductions: no real-device touch/gesture UAT (environment), P3-6 touch targets.

---

## RECOMMENDED_FIXES (order)
1. **P1-1** — planningScope season: use planning/crop year only (or explicit multi-year label). Touches `agriculture.calendar-view.ts` + one copy key; add regression assert (no `2000/27`-style output for Bago).
2. **P1-2** — drawer verification wording: derive from evidence badge, not raw V-level (TH). Touches `DetailDrawer` (or add a `detailVerificationReference` copy key).
3. **P2-3** — contrast: darken `--text-tertiary` or swap to `--text-secondary` on the smallest text. Globals.css token change + spot re-check.
4. **P2-4** — percent qualifier `≈`/`>` when `moreThan`.
5. **P2-5** — replace `V` header with a localized label.
6. **P3** — enlarge close target to 40px+, revisit truncation, optional.

## SAFE_TO_FIX_NOW
P1-1, P1-2, P2-4, P2-5 (localized UI + derivation changes; covered by existing `agriculture-calendar-ui.test.mjs` — extend with new asserts).

## DEFERRED_ITEMS
- P2-3 contrast token change (touches global design token → confirm with design team; it affects other modules too).
- P3-8 "เจริญเติบโต" stage badge — requires data (growth-stage rows or field verification), not a UI fix.
- Real-device touch UAT + full visual pass on hardware (env limitation here).

## READY_FOR_FIX_PASS = YES
(awaiting approval per instruction — no code was modified in this audit round)
