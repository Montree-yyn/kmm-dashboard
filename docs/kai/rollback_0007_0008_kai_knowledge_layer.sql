-- Manual rollback for KAI Phase 1E operations migrations.
-- Run only after confirming the six KAI tables are the intended rollback target.

DROP INDEX IF EXISTS `kai_history_created_at_idx`;
DROP INDEX IF EXISTS `kai_question_library_intent_idx`;
DROP INDEX IF EXISTS `kai_question_library_question_unique`;
DROP INDEX IF EXISTS `kai_data_dictionary_domain_idx`;
DROP INDEX IF EXISTS `kai_data_dictionary_mapping_unique`;
DROP TABLE IF EXISTS `kai_history`;
DROP TABLE IF EXISTS `kai_response_templates`;
DROP TABLE IF EXISTS `kai_query_templates`;
DROP TABLE IF EXISTS `kai_question_library`;
DROP TABLE IF EXISTS `kai_data_dictionary`;
DROP TABLE IF EXISTS `kai_metrics`;
