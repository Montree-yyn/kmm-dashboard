# Commission C3.2A production plan

Status: preparation only. No remote command in this document is authorized until C3.2B approval.

## Isolated lineage

`wrangler.production-commission.jsonc` uses `commission_prod_migrations`, not `d1_migrations`. Its only migration is `commission_prod_001`, which adds the nullable Commission column, the controlled alias table and the eight approved inactive identities. It has no KAI statements and writes only `OPERATIONS_DB`.

## Future C3.2B sequence

1. Export/backup `sales_transactions`, `salesperson_master`, and `salesperson_identity_aliases`, including row counts and schema.
2. Run `npx wrangler d1 migrations apply kmm-operations --remote --config wrangler.production-commission.jsonc` only after backup and a fresh production preview pass.
3. Generate a read-only preview from CPI v3 against Production rows. It must report 3,417 source rows, 341,705,800 MMK, zero positive unresolved/ambiguous rows and the verified Aung Bo Bo, Kaung Si Thu and Htet Lin Aung cases.
4. Generate an idempotent, transaction-ID-targeted Commission/identity update file from that preview. Apply it only after review; rerun preview and require zero pending changes.
5. Reconcile Production D1 and authenticated API totals to 341,705,800 MMK before any Worker deploy.

## Rollback

Keep the pre-write export and Worker `435ca02a-6c7a-44e4-95b9-45eb937dfabb`. If backfill is wrong, restore only `commission` and approved identity rows from the export; do not alter Sales Value, GP, Expense, Booking, Stock or Target. SQLite cannot safely drop the added column in place, so a schema rollback requires restoring the pre-write database backup rather than ad-hoc table rewrites.
