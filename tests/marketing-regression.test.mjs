import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Marketing route remains mounted through the existing page", async () => {
  const route = await read("app/marketing/page.tsx");
  assert.match(
    route,
    /import\s+\{\s*MarketingIntelligencePage\s*\}.*marketing-intelligence-page/,
  );
  assert.match(route, /<MarketingIntelligencePage\s*\/>/);
});

test("Marketing showroom markers remain data-backed and visibility-controlled", async () => {
  const map = await read(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
  );
  assert.match(
    map,
    /fetchOverlayJson<Showroom\[]>\("\/maps\/kmm-showrooms\.json"\)/,
  );
  assert.match(map, /showroomMarkersRef\.current\.set\(/);
  assert.match(map, /layerState\.showroom\s*&&/);
  assert.match(map, /visibleShowroomIds\.includes\(showroom\.id\)/);
  assert.match(map, /showroomMarkersRef\.current\.forEach\(\(marker, id\)/);
});

test("Marketing layer controls expose only data-backed layers as enabled", async () => {
  const controls = await read("lib/marketing/map-layer-controls.ts");
  assert.match(
    controls,
    /id:\s*"township-boundary"[\s\S]*?available:\s*true[\s\S]*?defaultEnabled:\s*true/,
  );
  assert.match(
    controls,
    /id:\s*"showroom"[\s\S]*?available:\s*true[\s\S]*?defaultEnabled:\s*true/,
  );
  assert.match(
    controls,
    /id:\s*"sales-heatmap"[\s\S]*?available:\s*true[\s\S]*?defaultEnabled:\s*true/,
  );
  for (const id of [
    "dealer",
    "customer",
    "booking-heatmap",
    "sales-visit",
    "campaign",
    "competitor",
    "stock-location",
  ]) {
    assert.match(
      controls,
      new RegExp(
        `id:\\s*"${id}"[\\s\\S]*?available:\\s*false[\\s\\S]*?defaultEnabled:\\s*false`,
      ),
    );
  }
});

test("Marketing layer toggles update existing map layers without reloading", async () => {
  const marketingMap = await read(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
  );
  const vectorMap = await read("components/maps/global-vector-map.tsx");
  assert.match(
    marketingMap,
    /setLayerState\(\(current\)\s*=>\s*\(\{\s*\.\.\.current,\s*\[group\]:\s*!current\[group\]\s*\}\)\)/,
  );
  assert.match(
    vectorMap,
    /setLayoutProperty\(fillLayerId,\s*"visibility",\s*isLayerGroupEnabled\("heatmap",\s*layerState\)/,
  );
  assert.match(
    vectorMap,
    /setLayoutProperty\(outlineLayerId,\s*"visibility",\s*isLayerGroupEnabled\("township-boundary",\s*layerState\)/,
  );
});

test("Marketing layer switch thumb stays inside its fixed track geometry", async () => {
  const manager = await read(
    "components/marketing/marketing-layer-manager.tsx",
  );
  const styles = await read("app/globals.css");
  assert.match(
    manager,
    /kmm-layer-switch-track relative h-\[20px\] w-\[34px\] rounded-full/,
  );
  assert.match(
    manager,
    /kmm-layer-switch-thumb absolute inset-y-0 left-0 my-auto size-4/,
  );
  assert.match(manager, /checked \? "translate-x-4" : "translate-x-0\.5"/);
  assert.doesNotMatch(styles, /\.kmm-layer-switch:active[\s\S]*?width:\s*18px/);
});

test("Marketing dropdowns own a stacking context above the map", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  const styles = await read("app/globals.css");
  assert.match(workspace, /aria-label="Decision Toolbar"/);
  assert.match(workspace, /className="kmm-decision-toolbar/);
  assert.match(
    styles,
    /\.kmm-decision-toolbar\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*20;[\s\S]*?overflow:\s*visible;/,
  );
  assert.match(workspace, /createPortal\(/);
  assert.match(workspace, /document\.body/);
  assert.match(workspace, /z-\[1000\]/);
  assert.match(workspace, /position: "fixed"/);
  assert.match(workspace, /availableBelow/);
  assert.match(workspace, /availableAbove/);
  assert.match(workspace, /openAbove/);
});

test("Marketing compare control matches filter control typography and geometry", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  const styles = await read("app/globals.css");
  assert.match(
    workspace,
    /kmm-compare-control inline-flex h-14 min-w-\[176px\][\s\S]*?rounded-xl[\s\S]*?px-3/,
  );
  assert.match(workspace, /max-sm:h-11/);
  assert.match(
    styles,
    /\.kmm-compare-control\s*\{[\s\S]*?font-size:\s*11px;[\s\S]*?font-weight:\s*700;/,
  );
});

test("Marketing decision filters keep staged selection, custom metric semantics, and compact responsive controls", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  const decisionToolbar = workspace.slice(
    workspace.indexOf("function DecisionToolbar"),
    workspace.indexOf("function Metric("),
  );
  const applyMultiSelect = workspace.slice(
    workspace.indexOf("function ApplyMultiSelect"),
    workspace.indexOf("function MetricSelector"),
  );

  assert.match(workspace, /inline-flex h-14 min-w-\[132px\]/);
  assert.match(workspace, /max-sm:h-11/);
  assert.match(workspace, /grid grid-cols-3 gap-1\.5/);
  assert.doesNotMatch(decisionToolbar, /ค้นหาปี\.\.\./);
  assert.doesNotMatch(decisionToolbar, /ค้นหาสินค้า\.\.\./);
  assert.doesNotMatch(applyMultiSelect, /<Check/);
  assert.match(workspace, /aria-expanded=\{open\}/);
  assert.match(workspace, /aria-controls=\{popoverId\}/);
  assert.match(workspace, /role = "dialog"/);
  assert.match(workspace, /role="listbox"/);
  assert.match(workspace, /role="alert"/);
  assert.match(workspace, /event\.key === "Escape"/);
  assert.match(workspace, /document\.addEventListener\("mousedown", onPointerDown\)/);
  assert.match(workspace, /document\.removeEventListener\("mousedown", onPointerDown\)/);
  assert.match(workspace, /popoverRef\.current\?\.contains\(target\)/);
  assert.match(workspace, /activeDropdown === dropdownId \|\| !open/);
  assert.match(workspace, /onActiveDropdownChange\(dropdownId\)/);
  assert.match(decisionToolbar, /useState<OpenMarketingFilter \| null>\(null\)/);
  assert.match(workspace, /onApply\(next\)/);
  assert.match(workspace, /onApply=\{applyYears\}/);
  assert.match(workspace, /onApply=\{applyMonths\}/);
  assert.match(workspace, /onProductsChange\(values as ProductGroup\[\]\)/);
  assert.match(decisionToolbar, /<MetricSelector/);
  assert.doesNotMatch(decisionToolbar, /<select/);
  assert.match(decisionToolbar, /onMetricChange\(next\.value, next\.mode\)/);
});

test("Marketing compare mode preserves one selection model across normal and fullscreen layouts", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  assert.match(workspace, /const enterCompareMode = useCallback/);
  assert.match(workspace, /const exitCompareMode = useCallback/);
  assert.match(
    workspace,
    /comparisonSelectionIds=\{\s*compareMode\s*\?\s*selectedComparisonTownshipIds\s*:\s*\[\]\s*\}/,
  );
  assert.match(
    workspace,
    /mapFullscreen\s*&&\s*compareMode[\s\S]*?<ComparisonPanel[\s\S]*?selectedTownships=\{selectedComparisonTownships\}[\s\S]*?floating/,
  );
});

test("Marketing fullscreen panels preserve the map-first workspace", async () => {
  const workspace = await read(
    "components/marketing/marketing-intelligence-page.tsx",
  );
  const map = await read(
    "components/marketing/myanmar-marketing-map-maplibre.tsx",
  );
  assert.match(workspace, /className="flex h-\[calc\(100vh-72px\)\]/);
  assert.match(workspace, /"grid min-h-0 flex-1 gap-0"/);
  assert.match(
    workspace,
    /mapFullscreen\s*&&\s*compareMode[\s\S]*?<ComparisonPanel[\s\S]*?floating/,
  );
  assert.match(
    map,
    /selectedMetric\s*&&\s*comparisonSelectionIds\.length\s*===\s*0/,
  );
  assert.match(map, /kmm-map-has-side-panel/);
  assert.match(map, /className="absolute inset-0"/);
});
