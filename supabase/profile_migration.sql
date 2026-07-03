-- 1. Modify the attendance table status constraint to support 'leave' (both lowercase and capitalized)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

ALTER TABLE public.attendance ADD CONSTRAINT attendance_status_check 
CHECK (status IN ('Present', 'Absent', 'Leave', 'present', 'absent', 'leave'));


-- 2. Add new profile columns to the students table if they don't exist
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS designation TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS joining_date DATE,
ADD COLUMN IF NOT EXISTS photo_url TEXT;


-- 3. Seed existing employee rows with realistic default profile information
UPDATE public.students 
SET 
  designation = CASE 
    WHEN register_number LIKE '%01' OR register_number LIKE '%5001' THEN 'Software Engineer'
    WHEN register_number LIKE '%02' OR register_number LIKE '%5002' THEN 'QA Engineer'
    WHEN register_number LIKE '%03' OR register_number LIKE '%5003' THEN 'UI/UX Designer'
    WHEN register_number LIKE '%04' OR register_number LIKE '%5004' THEN 'Product Manager'
    WHEN register_number LIKE '%06' OR register_number LIKE '%5006' THEN 'DevOps Engineer'
    WHEN register_number LIKE '%07' OR register_number LIKE '%5007' THEN 'Data Analyst'
    WHEN register_number LIKE '%08' OR register_number LIKE '%5008' THEN 'Systems Engineer'
    WHEN register_number LIKE '%09' OR register_number LIKE '%5009' THEN 'Solution Architect'
    WHEN register_number LIKE '%10' OR register_number LIKE '%5010' THEN 'Technical Lead'
    ELSE 'Associate Specialist'
  END,
  
  email = LOWER(REPLACE(name, ' ', '.')) || '.' || RIGHT(register_number, 3) || '@company.com',
  
  phone = '+91 98765 ' || RIGHT(register_number, 5),
  
  joining_date = CASE
    WHEN class LIKE '%4th%' THEN '2022-06-15'::DATE
    WHEN class LIKE '%3rd%' THEN '2023-06-15'::DATE
    WHEN class LIKE '%2nd%' THEN '2024-06-15'::DATE
    ELSE '2025-06-15'::DATE
  END,
  
  photo_url = 'https://api.dicebear.com/7.x/lorelei/svg?seed=' || REPLACE(name, ' ', '%20');
