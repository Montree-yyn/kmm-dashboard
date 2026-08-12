import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..');
const operationsDir = path.join(repoRoot, 'drizzle', 'operations');
const read = (file) => fs.readFileSync(path.join(repoRoot, file), 'utf8');

const migration = read('drizzle/operations/0009_create_kai_business_rules_alias_mapping.sql');
const baseSeed = read('drizzle/operations/0008_seed_kai_knowledge.sql');
const fixSeed = read('drizzle/operations/0010_seed_kai_phase1e_fix.sql');
const ruleReconciliation = read('drizzle/operations/0011_reconcile_kai_metric_business_rules.sql');

test('Phase 1E fix migration creates the requested knowledge tables safely', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `kai_business_rules`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `kai_alias_mapping`/);
  assert.match(migration, /CONSTRAINT `kai_business_rules_rule_code_unique` UNIQUE\(`rule_code`\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS `kai_alias_mapping_unique_term`/);

  for (const column of ['id', 'rule_code', 'rule_name', 'condition', 'severity', 'action', 'domain']) {
    assert.match(migration, new RegExp('`' + column + '`'));
  }
  for (const column of ['id', 'alias_word', 'canonical_term', 'intent', 'domain']) {
    assert.match(migration, new RegExp('`' + column + '`'));
  }
});

test('all 31 query intents have response templates after the fix seed', () => {
  const querySection = baseSeed
    .split('INSERT OR IGNORE INTO `kai_query_templates`')[1]
    .split('INSERT OR IGNORE INTO `kai_response_templates`')[0];
  const queryIntents = [...querySection.matchAll(/\('([A-Z0-9_]+)',/g)].map((match) => match[1]);

  const responseSections = [baseSeed, fixSeed]
    .map((seed) => seed.split('INSERT OR IGNORE INTO `kai_response_templates`')[1] ?? '')
    .join('\n');
  const responseIntents = new Set(
    [...responseSections.matchAll(/\('([A-Z0-9_]+)',/g)].map((match) => match[1]),
  );
  const orphanIntents = queryIntents.filter((intent) => !responseIntents.has(intent));

  assert.equal(queryIntents.length, 31);
  assert.deepStrictEqual(orphanIntents, []);
  assert.deepStrictEqual(
    ['BOOKING_BRANCH_RANKING', 'BOOKING_HISTORY_QUERY', 'BOOKING_MODEL_RANKING', 'BOOKING_VALUE_CURRENT',
      'SALES_GAP_QUERY', 'SALES_GROWTH_QUERY', 'SALES_PRODUCT_RANKING', 'SALES_VALUE_CURRENT', 'STOCK_MODEL_QUERY']
      .filter((intent) => !fixSeed.includes(`('${intent}',`)),
    [],
  );
});

test('business-rule seed covers every requested aging and product bucket', () => {
  const expectedRules = [
    ['BOOKING_AGING_0_30', 'age_days >= 0 AND age_days <= 30', 'Normal'],
    ['BOOKING_AGING_31_60', 'age_days >= 31 AND age_days <= 60', 'Monitor'],
    ['BOOKING_AGING_61_90', 'age_days >= 61 AND age_days <= 90', 'Risk'],
    ['BOOKING_AGING_GT_90', 'age_days > 90', 'Critical'],
    ['STOCK_AGING_0_90', 'age_days >= 0 AND age_days <= 90', 'Healthy'],
    ['STOCK_AGING_91_180', 'age_days >= 91 AND age_days <= 180', 'Monitor'],
    ['STOCK_AGING_181_365', 'age_days >= 181 AND age_days <= 365', 'Slow Moving'],
    ['STOCK_AGING_GT_365', 'age_days > 365', 'Critical'],
    ['PRODUCT_UNIT_CODES', 'product_type IN (TT, CH, EX, TP)', 'RULE'],
    ['PRODUCT_VALUE_ONLY_CODES', 'product_type IN (IM, IMO, OT)', 'RULE'],
  ];

  for (const [code, condition, severity] of expectedRules) {
    assert.match(fixSeed, new RegExp(`'${code}',`));
    assert.match(fixSeed, new RegExp(`'${condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',`));
    assert.match(fixSeed, new RegExp(`'${severity}',`));
  }
});

test('metric business rules point to the same complete rule buckets', () => {
  assert.match(ruleReconciliation, /WHERE `metric_code` = 'BOOK003'/);
  assert.match(ruleReconciliation, /WHERE `metric_code` = 'STOCK003'/);
  assert.match(ruleReconciliation, /WHERE `metric_code` = 'STOCK004'/);
  assert.match(ruleReconciliation, /0-30 วัน = Normal; 31-60 วัน = Monitor; 61-90 วัน = Risk/);
  assert.match(ruleReconciliation, /0-90 วัน = Healthy; 91-180 วัน = Monitor; 181-365 วัน = Slow Moving/);
  assert.match(ruleReconciliation, /รายละเอียดอ้างอิง kai_business_rules/);
});

test('alias seed includes the requested Thai business vocabulary', () => {
  const expectedAliases = [
    ['ขาย', 'Sales', 'SALES_CURRENT', 'sales'],
    ['ยอดขาย', 'Sales', 'SALES_CURRENT', 'sales'],
    ['จอง', 'Booking', 'BOOKING_CURRENT', 'booking'],
    ['ใบจอง', 'Booking', 'BOOKING_CURRENT', 'booking'],
    ['รถค้าง', 'Stock Aging', 'STOCK_AGING_QUERY', 'stock'],
    ['เกิน 90 วัน', 'Aging', 'STOCK_AGING_QUERY', 'stock'],
    ['รุ่น', 'Model', 'MODEL_FILTER', 'shared'],
  ];

  for (const [alias, canonical, intent, domain] of expectedAliases) {
    assert.match(fixSeed, new RegExp(
      `\\('${alias}', '${canonical}', '${intent}', '${domain}'\\)`,
    ));
  }
});

test('fix artifacts are present in the operations migration set', () => {
  assert.ok(fs.existsSync(path.join(operationsDir, '0009_create_kai_business_rules_alias_mapping.sql')));
  assert.ok(fs.existsSync(path.join(operationsDir, '0010_seed_kai_phase1e_fix.sql')));
  assert.ok(fs.existsSync(path.join(operationsDir, '0011_reconcile_kai_metric_business_rules.sql')));
  assert.ok(fs.existsSync(path.join(repoRoot, 'docs', 'kai', 'rollback_0009_0010_kai_phase1e_fix.sql')));
});
