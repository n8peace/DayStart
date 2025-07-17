-- Add AAC audio format support to audio-files storage bucket
-- ElevenLabs API returns audio in AAC format, which was not previously allowed

-- Update the audio-files bucket to include audio/aac in allowed MIME types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac']
WHERE id = 'audio-files';

-- Verify the update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'audio-files' 
    AND 'audio/aac' = ANY(allowed_mime_types)
  ) THEN
    RAISE EXCEPTION 'Failed to add audio/aac support to audio-files bucket';
  END IF;
END $$; 