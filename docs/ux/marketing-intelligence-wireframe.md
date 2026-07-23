# Marketing Intelligence — Decision Workspace Wireframe

## UX Summary

The Marketing Intelligence page is a GIS decision workspace, not a traditional KPI dashboard.

Its primary purpose is to help executives answer three questions:

1. ตอนนี้ตลาดเป็นอย่างไร? — Market Status
2. โอกาสอยู่ที่ไหน? — Where is the Opportunity?
3. ควรทำอะไรต่อ? — Next Best Action

The map is the main decision surface. All other interface elements exist to focus the map, explain a selected area, or help prepare an activity or area plan.

Core design principles:

- Map-first, with 70–80% of executive attention on the map.
- Thai primary language with recognized English business terms retained.
- Compact controls only; no large KPI cards above the map.
- Verified data only; future scores and recommendations must be clearly labeled as unavailable or placeholder.
- Preserve the stable map and business foundation: MapLibre, PMTiles, Natural Breaks, choropleth calculations, dynamic legend, hover, selected area behavior, layer order, showroom markers, canonical geography, reconciliation, and business totals.

---

## Desktop ASCII Wireframe

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ PAGE HEADER — 48–56px                                                        │
│ วิเคราะห์การตลาด (Marketing Intelligence)                                    │
│ ข้อมูลเชิงพื้นที่เพื่อวางแผนการตลาดและการขาย        Last update · ไทย | EN  │
├──────────────────────────────────────────────────────────────────────────────┤
│ COMPACT DECISION TOOLBAR — 52–60px                                           │
│ ช่วงเวลา ▾ | มุมมอง ▾ | สินค้า ▾ | ระดับพื้นที่ ▾ | ชั้นข้อมูล ▾ | เปรียบเทียบ ▾ │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ LARGE INTERACTIVE MAP WORKSPACE                                              │
│                                                                              │
│  ┌────────────────────┐                              ┌────────────────────┐  │
│  │ FLOATING TOOLS     │                              │ RIGHT INTELLIGENCE │  │
│  │                    │                              │ PANEL              │  │
│  │ คำอธิบายสี         │                              │                    │  │
│  │ ชั้นข้อมูล         │                              │ Area Header        │  │
│  │ Zoom               │                              │ Market Status      │  │
│  │ Fullscreen         │                              │ Sales Performance  │  │
│  │ Reset View         │                              │ Marketing Activity │  │
│  └────────────────────┘                              │ Opportunity & Risk │  │
│                                                      │ Recommendation     │  │
│                                                      │ Next Action        │  │
│                                                      └────────────────────┘  │
│                                                                              │
│             MapLibre + PMTiles Myanmar GIS Map                               │
│             Choropleth / Labels / Showrooms / Hover / Selection              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ COLLAPSIBLE BOTTOM ACTION CENTER — 40–48px collapsed                         │
│ โอกาสสูง | ต้องติดตาม | ประสิทธิผลกิจกรรม | แผนดำเนินการถัดไป              │
└──────────────────────────────────────────────────────────────────────────────┘
```

When no State, Township, or Showroom is selected:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Header                                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Compact Decision Toolbar                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Floating Tools                                                              │
│                                                                              │
│                  Full-width map-first decision surface                       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Collapsible Action Center                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Laptop Wireframe

Recommended for standard laptop widths, approximately 1024–1439px.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Header — compact title, last update, language                         │
├──────────────────────────────────────────────────────────────────────┤
│ Toolbar — compact dropdowns, single row where possible                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌──────────────┐                         ┌─────────────────────────┐ │
│ │ Floating     │                         │ Intelligence Panel       │ │
│ │ Tools        │                         │ 320–340px                │ │
│ └──────────────┘                         │                         │ │
│                                          │ Scrollable area details  │ │
│             Map remains dominant         │                         │ │
│                                          └─────────────────────────┘ │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Action Center — collapsed by default, horizontal overflow if needed   │
└──────────────────────────────────────────────────────────────────────┘
```

Laptop rules:

- Sidebar should default collapsed.
- Toolbar uses compact dropdown controls.
- Comparison can move into a secondary popover if horizontal space is tight.
- Right panel reduces to 320–340px.
- Bottom Action Center remains collapsible.

---

## Tablet Wireframe

Recommended for widths around 768–1023px.

```text
┌────────────────────────────────────────────┐
│ Header                                     │
├────────────────────────────────────────────┤
│ Toolbar row 1: Time | View | Product       │
│ Toolbar row 2: Geography | Layers | Compare│
├────────────────────────────────────────────┤
│                                            │
│ Floating icon controls                     │
│                                            │
│             Primary Map View               │
│                                            │
├────────────────────────────────────────────┤
│ Action Center — collapsed                  │
└────────────────────────────────────────────┘

Right Intelligence Panel:
slides in as drawer after area selection.
```

Tablet rules:

- Sidebar becomes a drawer.
- Toolbar may become two compact rows.
- Map remains the primary view.
- Right Intelligence Panel becomes a drawer.
- Floating controls become icon-first.
- Action Center is collapsed by default.

---

## Mobile Wireframe

Recommended for widths below 768px.

```text
┌──────────────────────────────┐
│ Header                       │
├──────────────────────────────┤
│ Filter chips / Toolbar sheet │
├──────────────────────────────┤
│                              │
│       Map-first view         │
│                              │
│ Floating icon controls       │
│                              │
├──────────────────────────────┤
│ Action Center tab / sheet    │
└──────────────────────────────┘

Area Intelligence:
opens as a bottom drawer after State, Township, or Showroom selection.
```

Mobile rules:

- Do not shrink the desktop layout.
- Filters open in a bottom sheet.
- Area Intelligence opens as a bottom drawer.
- Action Center becomes a separate sheet or tab.
- Map remains the first and primary view.
- Floating controls become compact icon buttons with accessible labels.

---

## Component Hierarchy

Conceptual hierarchy only:

```text
MarketingIntelligencePage
├── MarketingPageHeader
│   ├── PageTitle
│   ├── PageSubtitle
│   ├── LastDataUpdate
│   ├── LanguageSelector
│   └── OptionalRefreshAction
├── DecisionToolbar
│   ├── TimeSelector
│   ├── ViewSelector
│   ├── ProductSelector
│   ├── GeographySelector
│   ├── LayerMenu
│   └── ComparisonControl
├── MarketingMapWorkspace
│   ├── ExistingMyanmarMap
│   ├── MapStatusPill
│   ├── GeographyBreadcrumb
│   ├── FloatingLegend
│   ├── FloatingLayerControl
│   ├── MapNavigationControls
│   └── DevelopmentDebugEntry
├── AreaIntelligencePanel
│   ├── AreaHeader
│   ├── MarketStatusSection
│   ├── SalesPerformanceSection
│   ├── MarketingActivitySection
│   ├── OpportunityRiskSection
│   ├── RecommendationSection
│   └── NextActionSection
└── ActionCenter
    ├── HighOpportunitySection
    ├── NeedAttentionSection
    ├── ActivityEffectivenessSection
    └── NextActionPlanningSection
```

---

## Toolbar Specification

The toolbar is the single decision-control surface. It should be compact, one row on desktop, and focused only on controls required for decision-making.

Recommended height: 52–60px.

```text
ช่วงเวลา ▾ | มุมมอง ▾ | สินค้า ▾ | ระดับพื้นที่ ▾ | ชั้นข้อมูล ▾ | เปรียบเทียบ ▾
```

### ช่วงเวลา (Time)

Options:

- เดือนนี้
- ไตรมาสนี้
- สะสมตั้งแต่ต้นปี (YTD)
- ย้อนหลัง 12 เดือน
- กำหนดช่วงเวลา

Recommended default:

- สะสมตั้งแต่ต้นปี (YTD)

Behavior:

- Selected date range appears as secondary text inside the Time popover.
- Custom date selection appears inside the popover, not directly on the toolbar.
- Comparison period is handled in the Comparison popover, not crowded into Time.

### มุมมอง (View)

This is the main map mode selector.

Recommended views:

- สถานะตลาด (Market Status)
- ผลการขาย (Sales Performance)
- ประสิทธิผลกิจกรรม (Activity Effectiveness)
- โอกาสพื้นที่ (Opportunity)
- ความเสี่ยงพื้นที่ (Risk)

Current verified-data readiness:

| View | Status |
|---|---|
| ผลการขาย (Sales Performance) | Available from existing verified Sales, GP, Booking where supported |
| สถานะตลาด (Market Status) | Partially available from Installed Base, Sales, Marketing Activity |
| ประสิทธิผลกิจกรรม (Activity Effectiveness) | Partially available from activity count/date/type; ROI requires verified attribution |
| โอกาสพื้นที่ (Opportunity) | Future placeholder until scoring logic is verified |
| ความเสี่ยงพื้นที่ (Risk) | Future placeholder until scoring logic is verified |

Rule:

- Do not create fake metrics or scores.
- Future views must show “Awaiting verified scoring logic.”

### สินค้า (Product)

Options:

- ทั้งหมด
- Tractor
- Combine Harvester
- Excavator
- Rice Transplanter
- Other supported product categories from existing data

Recommended control:

- Compact dropdown

Reason:

- Uses less space than segmented controls.
- Product names can be long.
- Product list can grow later.

### ระดับพื้นที่ (Geography)

Options:

- State / Region
- Township
- Showroom

Recommended default:

- Township

Behavior:

- Toolbar controls intended analysis level.
- Map zoom controls visual detail.
- A breadcrumb inside the map workspace helps users return to a higher level.
- Do not include Village level unless verified data supports it reliably.

### ชั้นข้อมูล (Layers)

Separate base analytical metric from optional overlays.

Base analytical metric:

- Only one choropleth fill layer can be active at a time.
- The active metric should usually be driven by View.

Optional overlays:

- โชว์รูม
- Dealer
- Road Network
- Marketing Activity markers, if verified
- Competitor — Future
- Crop / Market Potential — Future

Interaction rules:

- Only one choropleth layer active at once.
- Showroom markers can remain visible over any choropleth.
- Road Network can remain under township fills.
- Future layers are disabled with clear explanatory text.
- Overlay layers must not change business totals or canonical joins.
- Existing layer order remains preserved.

### เปรียบเทียบ (Comparison)

Modes:

- ไม่เปรียบเทียบ
- เทียบงวดก่อน
- ช่วงเดียวกันของปีก่อน
- กำหนดเอง

Recommended UX:

- Compact secondary popover.
- Visible only where comparison is useful, especially Sales Performance and Activity Effectiveness.
- Results appear in hover tooltip, right panel, and Action Center.
- No large comparison widgets above the map.

---

## Right Intelligence Panel

The panel appears only after the user selects a State / Region, Township, or Showroom.

When nothing is selected:

- Panel is collapsed.
- Map uses full workspace.

Recommended width:

- 320–380px
- Max 400px

Panel questions:

1. พื้นที่นี้เป็นอย่างไร?
2. มีโอกาสหรือความเสี่ยงอะไร?
3. ควรทำอะไรต่อ?

Panel structure:

```text
┌────────────────────────────────────┐
│ Area Header                         │
│ Area name                           │
│ Geography type                      │
│ Responsible showroom                │
│ Selected period                     │
│ Product filter                      │
│ Close                               │
├────────────────────────────────────┤
│ Market Status                       │
│ Installed Base                      │
│ Product population                  │
│ Customer population                 │
│ Market coverage                     │
├────────────────────────────────────┤
│ Sales Performance                   │
│ Sales Unit                          │
│ Sales Value                         │
│ GP                                  │
│ GP%                                 │
│ Booking                             │
│ Achievement, if target exists       │
├────────────────────────────────────┤
│ Marketing Activity                  │
│ Activity count                      │
│ Activity type                       │
│ Latest activity date                │
│ Leads                               │
│ Booking after activity              │
│ Sales after activity                │
│ Cost / ROI                          │
├────────────────────────────────────┤
│ Opportunity and Risk                │
│ Opportunity Score — placeholder     │
│ Risk Score — placeholder            │
│ Market Coverage                     │
│ Marketing Effectiveness             │
│ Dealer Strength                     │
├────────────────────────────────────┤
│ Recommendation                      │
│ ข้อเสนอแนะเบื้องต้น                 │
│ Rule-based Recommendation           │
├────────────────────────────────────┤
│ Next Action                         │
│ Recommended activity                │
│ Priority                            │
│ Suggested timeframe                 │
│ Responsible team                    │
│ Create plan — future disabled       │
└────────────────────────────────────┘
```

Data rules:

- Use verified metrics only.
- Hide unavailable fields or label them clearly.
- Do not estimate missing values.
- Do not implement Opportunity Score or Risk Score until formulas and verified inputs exist.
- Recommendations are rule-based placeholders only, not AI-generated.

Required verified data examples for future scores:

| Score | Required verified data |
|---|---|
| Opportunity Score | Sales, Installed Base, product population, activity coverage, territory potential |
| Risk Score | GP trend, booking decline, sales decline, low activity, unresolved geography, showroom coverage |
| Market Coverage | Installed Base, showroom responsibility, territory size or customer coverage |
| Marketing Effectiveness | Activity count, cost, leads, booking/sales attribution |
| Dealer Strength | Dealer/showroom coverage, performance, activity support, service footprint |

Recommended unavailable states:

- ยังไม่มีข้อมูลที่ยืนยันแล้ว
- Awaiting verified scoring logic

---

## Bottom Action Center

The Bottom Action Center replaces large KPI cards. It should be collapsible and action-oriented.

Collapsed height:

- 40–48px

Expanded height:

- 160–220px

Collapsed state:

```text
Action Center ▾
โอกาสสูง | ต้องติดตาม | ประสิทธิผลกิจกรรม | แผนดำเนินการถัดไป
```

Expanded state:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Action Center                                                                │
├──────────────────────┬──────────────────────┬──────────────────────────────┤
│ โอกาสสูง             │ ต้องติดตาม            │ ประสิทธิผลกิจกรรม            │
│ Count                │ Count                │ Count                         │
│ Top 3 areas          │ Top 3 areas          │ Top 3 areas                   │
│ One-line reason      │ One-line reason      │ One-line reason               │
│ Focus action         │ Focus action         │ Focus action                  │
├──────────────────────┴──────────────────────┴──────────────────────────────┤
│ แผนดำเนินการถัดไป                                                           │
│ Recommended campaign / area plan / follow-up                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

Categories:

1. โอกาสสูง (High Opportunity)
2. ต้องติดตาม (Need Attention)
3. ประสิทธิผลกิจกรรม (Activity Effectiveness)
4. แผนดำเนินการถัดไป (Next Action)

Each category should show:

- Count of relevant areas
- Top 3 areas
- One-line reason
- Quick focus action

No fake values:

- If verified data is unavailable, show “ยังไม่มีข้อมูลที่ยืนยันแล้ว.”
- If scoring is future, show “รอสูตรการประเมินที่ยืนยันแล้ว.”

Behavior:

- Collapsed by default.
- Can open manually.
- May open automatically when a selected area has verified decision signals.
- If an area is selected, highlight whether that area belongs to any Action Center category.
- Must not duplicate every metric from the right panel.

---

## User Flow

1. User opens วิเคราะห์การตลาด (Marketing Intelligence).
2. Thai interface loads by default.
3. Map is immediately visible and dominant.
4. User selects ช่วงเวลา (Time).
5. User selects สินค้า (Product).
6. User selects มุมมอง (View), such as ผลการขาย (Sales Performance).
7. Map choropleth and legend update.
8. User explores the map with zoom, pan, hover, and optional layers.
9. User selects State / Region, Township, or Showroom.
10. Selected outline appears.
11. Right Intelligence Panel opens.
12. User reviews Market Status, Sales Performance, Marketing Activity, Opportunity/Risk, Recommendation, and Next Action.
13. User opens Action Center if needed.
14. User prepares campaign, visit, showroom follow-up, or area plan.
15. User clears selection; panel collapses and map returns to full-width hero mode.

---

## Information Hierarchy

### Level 1 — Map Overview

Purpose:

- Users see spatial patterns across Myanmar.

Belongs here:

- Active choropleth
- Current metric
- Current period
- Legend
- State/Township labels
- Showroom markers
- Hover tooltip
- Selected outline
- National spatial pattern

Must not duplicate:

- Full KPI tables
- Long explanations
- Full township detail
- Recommendation blocks

### Level 2 — Area Intelligence

Purpose:

- User selects an area and understands details.

Belongs here:

- Selected area name
- Geography type
- Responsible showroom
- Sales
- GP
- Booking
- Installed Base
- Marketing Activity
- Verified no-data states
- Opportunity/Risk placeholders
- Rule-based recommendation placeholder
- Next action block

Must not duplicate:

- Full national ranking
- All Action Center categories
- Toolbar filters
- Layer controls

### Level 3 — Action Planning

Purpose:

- User prepares an activity or area plan.

Belongs here:

- High opportunity areas
- Areas needing attention
- Activity effectiveness summary
- Recommended campaign
- Next action
- Top 3 areas per category
- Quick focus action

Must not duplicate:

- Full side-panel metrics
- Raw tables
- Debug information
- Detailed row-level data

---

## Dimensions

Approximate guidance only; not pixel-perfect CSS.

| Element | Recommended dimension |
|---|---:|
| Header height | 48–56px |
| Toolbar height | 52–60px |
| Sidebar collapsed width | 72px |
| Sidebar expanded width | 220–240px |
| Right Intelligence Panel width | 320–380px |
| Right Intelligence Panel max width | 400px |
| Bottom Action Center collapsed | 40–48px |
| Bottom Action Center expanded | 160–220px |
| Floating control width | 128–160px |
| Floating button size | 36–40px |
| Map edge padding | 12–16px |
| Workspace padding | 12–16px |
| Internal panel padding | 16–20px |
| Control gap | 8–12px |
| Section gap | 12–16px |
| Border radius | 10–12px |

Map allocation:

- Right panel closed: map uses nearly full workspace width.
- Right panel open: map remains 60–70% of available content width.
- Map should receive 70–80% of primary visual attention.

---

## Responsive Rules

### Large desktop, ≥1440px

- Full toolbar in one row.
- Right panel opens beside map.
- Bottom Action Center can show all sections.
- Floating controls stay inside map.

### Standard laptop, 1024–1439px

- Sidebar collapsed by default.
- Toolbar uses compact dropdowns.
- Comparison moves into a secondary popover if crowded.
- Right panel width reduces to 320–340px.
- Bottom Action Center remains collapsible.

### Tablet, 768–1023px

- Sidebar becomes drawer.
- Toolbar may become two compact rows.
- Right panel becomes drawer.
- Map remains primary.
- Floating controls become icon-first.
- Action Center collapsed by default.

### Mobile, <768px

- Header remains compact.
- Toolbar becomes filter chips or bottom sheet.
- Map is the primary first view.
- Area Intelligence opens as bottom drawer.
- Action Center becomes separate tab or sheet.
- Do not shrink the desktop layout into mobile.

---

## Future Roadmap

### Phase 1 — UX Shell Migration

- Replace KPI-first page structure with map-first workspace.
- Move existing time/product/metric controls into compact Decision Toolbar.
- Move legend and layer controls into floating map controls.
- Keep existing map behavior unchanged.

### Phase 2 — Area Intelligence Refinement

- Redesign Township Detail as Area Intelligence Panel.
- Support State / Region, Township, and Showroom selected-area modes where verified data exists.
- Preserve canonical_location_id joins and verified data rules.

### Phase 3 — Action Center

- Move executive summaries into collapsible Action Center.
- Show only verified categories and no-data states.
- Avoid fake opportunity or risk values.

### Phase 4 — Verified Opportunity and Risk

- Define and validate Opportunity Score inputs.
- Define and validate Risk Score inputs.
- Add Market Coverage, Marketing Effectiveness, and Dealer Strength only after formulas and data are verified.

### Phase 5 — Rule-Based Recommendations

- Add clearly labeled rule-based Recommendation.
- Keep AI Recommendation disabled until an approved model, data policy, and validation framework exist.

### Phase 6 — Planning Workflow

- Enable future “Create plan” workflow only after activity planning data model and permissions exist.

### Phase 7 — Localization Expansion

- Continue Thai-first UX.
- Preserve English business terminology where useful.
- Add Myanmar language later through the centralized localization foundation.

