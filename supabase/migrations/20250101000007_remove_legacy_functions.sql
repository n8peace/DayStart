-- Remove legacy functions from develop branch
-- These functions are no longer needed and should be cleaned up

-- Note: This migration documents the removal of legacy functions
-- The actual removal happens through the Supabase CLI when functions are deleted locally
-- and then deployed to the remote environment

-- Legacy functions to be removed:
-- - generate-message
-- - test-voice

-- These functions were part of the initial development but are no longer part of the
-- current content generation architecture. The new functions are:
-- - generate-wake-up-content
-- - generate-weather-content  
-- - generate-headlines-content
-- - generate-sports-content
-- - generate-markets-content
-- - generate-encouragement-content

-- Migration completed: 2025-01-15
-- Status: Legacy functions removed from develop branch 