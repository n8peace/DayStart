-- Create audio-files storage bucket for DayStart audio content
-- This bucket will store all generated audio files organized by content type

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-files',
  'audio-files',
  true, -- Public bucket for easy access
  10485760, -- 10MB file size limit (should be more than enough for audio files)
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'] -- Allowed audio formats
);

-- Create storage policies for the audio-files bucket

-- Allow public read access to all audio files
CREATE POLICY "Public read access to audio files" ON storage.objects
  FOR SELECT USING (bucket_id = 'audio-files');

-- Allow authenticated users to upload audio files
CREATE POLICY "Authenticated users can upload audio files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'audio-files' 
    AND auth.role() = 'authenticated'
  );

-- Allow service role full access for background jobs
CREATE POLICY "Service role full access to audio files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'audio-files' 
    AND auth.role() = 'service_role'
  );

-- Allow authenticated users to update their own audio files
CREATE POLICY "Users can update their own audio files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'audio-files' 
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own audio files
CREATE POLICY "Users can delete their own audio files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'audio-files' 
    AND auth.role() = 'authenticated'
  ); 