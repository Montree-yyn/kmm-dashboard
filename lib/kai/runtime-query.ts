// Public Phase 2B runtime entrypoint. Kept as a stable module path for the
// API route and the existing Phase 2A regression suite.
export {
  executeKaiRuntimeQuery,
  KaiRuntimeQueryError,
  normalizeRuntimeQuestion,
} from "./runtime-query-v2";

export type {
  RuntimePreparedStatement,
  RuntimeQueryContext,
  RuntimeQueryDatabase,
  RuntimeQueryResult,
} from "./runtime-query-v2";
