-- =======================================================
-- Supabase Migration: WhatsApp Leave Approval Workflow
-- =======================================================

-- Create leave_audit_logs table to track every request, approval, rejection, and admin action
CREATE TABLE IF NOT EXISTS public.leave_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('Submitted', 'Approved', 'Rejected')),
  performed_by TEXT NOT NULL, -- 'Student', 'Admin (WhatsApp)', 'Admin (Dashboard)'
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for leave_audit_logs
ALTER TABLE public.leave_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read leave_audit_logs" ON public.leave_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert leave_audit_logs" ON public.leave_audit_logs;
CREATE POLICY "Anyone can read leave_audit_logs" ON public.leave_audit_logs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leave_audit_logs" ON public.leave_audit_logs FOR INSERT WITH CHECK (true);

-- Index for lookup speed
CREATE INDEX IF NOT EXISTS idx_leave_audit_request ON public.leave_audit_logs (request_id);
CREATE INDEX IF NOT EXISTS idx_leave_audit_student ON public.leave_audit_logs (student_id);
