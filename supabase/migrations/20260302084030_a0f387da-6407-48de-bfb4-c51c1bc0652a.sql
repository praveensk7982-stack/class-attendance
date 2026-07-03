-- Create students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  register_number TEXT NOT NULL UNIQUE,
  class TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Public read access for students
CREATE POLICY "Anyone can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Anyone can insert students" ON public.students FOR INSERT WITH CHECK (true);

-- Public access for attendance
CREATE POLICY "Anyone can read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Anyone can insert attendance" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update attendance" ON public.attendance FOR UPDATE USING (true);

-- Indexes for fast lookups
CREATE INDEX idx_attendance_student_date ON public.attendance (student_id, date);
CREATE INDEX idx_attendance_date ON public.attendance (date);