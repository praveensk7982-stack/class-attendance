-- =======================================================
-- Supabase Migration: Full Attendance Management System Schema
-- =======================================================

-- 1. Ensure students table exists and has all profile columns
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  register_number TEXT NOT NULL UNIQUE,
  class TEXT NOT NULL,
  department TEXT NOT NULL,
  designation TEXT,
  email TEXT,
  phone TEXT,
  joining_date DATE,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for students
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read students" ON public.students;
DROP POLICY IF EXISTS "Anyone can insert students" ON public.students;
DROP POLICY IF EXISTS "Anyone can update students" ON public.students;
DROP POLICY IF EXISTS "Anyone can delete students" ON public.students;
CREATE POLICY "Anyone can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Anyone can insert students" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update students" ON public.students FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete students" ON public.students FOR DELETE USING (true);


-- 2. Ensure attendance table exists with is_late column
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  is_late BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

-- Alter check constraint on status
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('Present', 'Absent', 'Leave', 'present', 'absent', 'leave'));

-- Enable RLS for attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read attendance" ON public.attendance;
DROP POLICY IF EXISTS "Anyone can insert attendance" ON public.attendance;
DROP POLICY IF EXISTS "Anyone can update attendance" ON public.attendance;
DROP POLICY IF EXISTS "Anyone can delete attendance" ON public.attendance;
CREATE POLICY "Anyone can read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update attendance" ON public.attendance FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete attendance" ON public.attendance FOR DELETE USING (true);


-- 3. Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for leave_requests
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Anyone can insert leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Anyone can update leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Anyone can delete leave_requests" ON public.leave_requests;
CREATE POLICY "Anyone can read leave_requests" ON public.leave_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leave_requests" ON public.leave_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leave_requests" ON public.leave_requests FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete leave_requests" ON public.leave_requests FOR DELETE USING (true);


-- 4. Create fine_settings table
CREATE TABLE IF NOT EXISTS public.fine_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  late_fine_rate NUMERIC NOT NULL DEFAULT 50,
  leave_fine_rate NUMERIC NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default fine settings if not exists
INSERT INTO public.fine_settings (late_fine_rate, leave_fine_rate)
SELECT 50, 100
WHERE NOT EXISTS (SELECT 1 FROM public.fine_settings);

-- Enable RLS for fine_settings
ALTER TABLE public.fine_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read fine_settings" ON public.fine_settings;
DROP POLICY IF EXISTS "Anyone can update fine_settings" ON public.fine_settings;
CREATE POLICY "Anyone can read fine_settings" ON public.fine_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can update fine_settings" ON public.fine_settings FOR UPDATE USING (true);


-- 5. Create student_fines table
CREATE TABLE IF NOT EXISTS public.student_fines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  month INTEGER NOT NULL, -- 0-11
  year INTEGER NOT NULL,
  late_fine_paid BOOLEAN DEFAULT false,
  leave_fine_paid BOOLEAN DEFAULT false,
  payment_status TEXT NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, month, year)
);

-- Enable RLS for student_fines
ALTER TABLE public.student_fines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read student_fines" ON public.student_fines;
DROP POLICY IF EXISTS "Anyone can insert student_fines" ON public.student_fines;
DROP POLICY IF EXISTS "Anyone can update student_fines" ON public.student_fines;
DROP POLICY IF EXISTS "Anyone can delete student_fines" ON public.student_fines;
CREATE POLICY "Anyone can read student_fines" ON public.student_fines FOR SELECT USING (true);
CREATE POLICY "Anyone can insert student_fines" ON public.student_fines FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update student_fines" ON public.student_fines FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete student_fines" ON public.student_fines FOR DELETE USING (true);


-- 6. Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_leave_requests_student ON public.leave_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_student_fines_lookup ON public.student_fines (student_id, month, year);
