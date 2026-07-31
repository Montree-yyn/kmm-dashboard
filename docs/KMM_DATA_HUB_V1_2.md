# KMM Data Hub v1.2

## Purpose

Data Hub is the controlled entry point for enterprise spreadsheet imports. It keeps data intake separate from dashboard calculations and provides a consistent path from file review to a future persistent import service.

## Source Registry

Transactional sources: Sales, Booking, Stock, Expense, Marketing and Team. Master Data is presented first as the system-wide reference source.

Master Data is a registry of Product, Model, Branch, Township, Salesman, Customer Type, Dealer, Campaign and Price List schemas. Existing Employee and Customer schemas remain available for backward-compatible reference use. New types are added by defining their fields and duplicate keys in `lib/data-hub/source-definitions.ts`; the source picker and validator consume that registry without a new import workflow.

## Import Status Flow

`Ready -> Uploading -> Validating -> Warning (when applicable) -> Importing -> Success`

Any parser or validation issue becomes `Failed`. The status card exposes the reason, failed-row count and a CSV error report. Import history records rows, success, warning, error, importer, time, duration and planned rollback state. `Rollback` is defined as a future persistent-service state and cannot claim to reverse a session-only import.

## Persistence Boundary

v1.2 is session-only. `lib/data-hub/import-service.ts` is the intentional future API boundary; it does not mutate Firebase, the database, dashboards or business calculations. Persistent history, approval ownership and rollback remain future work.
