-- Create a bucket for attendance selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance_selfies', 'attendance_selfies', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read attendance selfies" ON storage.objects FOR SELECT USING (bucket_id = 'attendance_selfies');
CREATE POLICY "Allow authenticated upload attendance selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance_selfies');
CREATE POLICY "Allow anon upload attendance selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attendance_selfies');
