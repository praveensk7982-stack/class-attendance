import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeaveRequest } from "@/data/students";
import { 
  FileText, 
  Calendar, 
  Send, 
  Clock, 
  Loader2, 
  CheckCircle, 
  XCircle,
  HelpCircle
} from "lucide-react";

interface StudentLeaveProps {
  student: any;
}

const LeaveTypes = [
  "Sick Leave",
  "Casual Leave",
  "Earned Leave",
  "Maternity/Paternity Leave",
  "Unpaid Leave"
];

const StudentLeave = ({ student }: StudentLeaveProps) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [leaveType, setLeaveType] = useState(LeaveTypes[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMyLeaves = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("student_id", student.id);

      if (!error && data) {
        const sorted = (data as LeaveRequest[]).sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setRequests(sorted);
      } else {
        // Fallback
        const stored = localStorage.getItem("local_leave_requests");
        if (stored) {
          const list: LeaveRequest[] = JSON.parse(stored);
          const filtered = list.filter(r => r.student_id === student.id.toString());
          setRequests(filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } else {
          setRequests([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
    
    // Listen for updates from the WhatsApp simulator
    const handleStatusUpdate = () => {
      fetchMyLeaves();
    };

    window.addEventListener("leave-status-updated", handleStatusUpdate);

    // Realtime subscription: auto-refresh when HOD approves/rejects via WhatsApp webhook
    const channel = supabase
      .channel(`leave_requests_student_${student.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
          filter: `student_id=eq.${student.id}`,
        },
        () => {
          console.log("Realtime event received, refreshing leaves...");
          fetchMyLeaves();
        }
      )
      .subscribe((status) => {
        console.log("Realtime channel status:", status);
      });

    return () => {
      window.removeEventListener("leave-status-updated", handleStatusUpdate);
      supabase.removeChannel(channel);
    };
  }, [student.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      setFormError("All required fields must be populated.");
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (end < start) {
      setFormError("End date must fall on or after the starting date.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const newRequest = {
      student_id: student.id,
      student_name: student.name,
      leave_type: leaveType,
      from_date: fromDate,
      to_date: toDate,
      reason: reason.trim(),
      status: 'Pending'
    };

    try {
      // 1. Try Supabase insert
      const { data, error } = await supabase
        .from("leave_requests")
        .insert([newRequest])
        .select();

      if (!error && data && data.length > 0) {
        const createdReq = data[0];
        setRequests(prev => [createdReq as LeaveRequest, ...prev]);

        // 2. Log submission to leave_audit_logs
        try {
          await supabase.from("leave_audit_logs").insert({
            request_id: createdReq.id,
            student_id: student.id,
            action: 'Submitted',
            performed_by: 'Student',
            details: `Leave application submitted: ${leaveType} range ${fromDate} to ${toDate}`
          });
        } catch (errLog) {
          console.error("Audit log creation failed:", errLog);
        }

        // Fire custom event for WhatsApp simulation to intercept
        window.dispatchEvent(
          new CustomEvent("new-leave-request", {
            detail: {
              id: createdReq.id,
              student_id: student.id,
              student_name: student.name,
              register_number: student.register_number,
              leave_type: leaveType,
              from_date: fromDate,
              to_date: toDate,
              reason: reason.trim(),
              status: 'Pending'
            }
          })
        );

        // Notify HOD via WhatsApp (fire-and-forget; don't block the UI on this)
        try {
          const { error: fnError } = await supabase.functions.invoke('send-leave-whatsapp', {
            body: {
              requestId: createdReq.id,
              employeeName: student.name,
              leaveType: leaveType,
              fromDate: fromDate,
              toDate: toDate,
              reason: reason.trim()
            }
          });
          if (fnError) {
            console.error("WhatsApp notification failed:", fnError);
          }
        } catch (fnErr) {
          console.error("WhatsApp notification error:", fnErr);
        }

        triggerToast("Leave application registered in database successfully! ✓", true);
      } else {
        // Fallback local storage insert
        const newLocal: LeaveRequest = {
          ...newRequest,
          id: Math.random().toString(),
          student_name: student.name,
          register_number: student.register_number,
          created_at: new Date().toISOString(),
          status: 'Pending'
        };

        // Fire custom event for offline simulator support
        window.dispatchEvent(
          new CustomEvent("new-leave-request", {
            detail: newLocal
          })
        );

        const stored = localStorage.getItem("local_leave_requests") || "[]";
        const list = JSON.parse(stored);
        list.push(newLocal);
        localStorage.setItem("local_leave_requests", JSON.stringify(list));

        setRequests(prev => [newLocal, ...prev]);
        triggerToast("Leave request saved locally successfully! ✓", true);
      }

      // Reset
      setReason("");
      setFromDate("");
      setToDate("");
    } catch (err) {
      console.error(err);
      setFormError("Failed to apply for leave. Retry again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8 grid grid-cols-1 gap-8 lg:grid-cols-3 animate-slide-up-fast">
      
      {/* Form column (1 column) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-1 h-fit">
        <div className="border-b border-border/40 pb-4 mb-4">
          <h3 className="font-display text-[1.05rem] font-bold">Apply for Leave</h3>
          <p className="text-[0.72rem] text-muted-foreground mt-0.5">
            Submit leave request for <strong className="text-primary">{student.name}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Student Name</label>
            <input 
              type="text" 
              readOnly 
              value={student.name} 
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.88rem] text-foreground outline-none cursor-default opacity-85 select-none focus:border-border" 
            />
          </div>

          <div>
            <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Leave Category</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
            >
              {LeaveTypes.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">From Date</label>
              <input
                type="date"
                required
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">To Date</label>
              <input
                type="date"
                required
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Reason</label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Health checkup, family wedding"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
            />
          </div>

          {formError && <p className="text-warn text-[0.78rem]">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[0.82rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
          >
            <Send className="h-4 w-4" /> {submitting ? "Submitting..." : "Send Application"}
          </button>
        </form>
      </div>

      {/* Requests History List (2 columns) */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-2">
        <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4 mb-4">My Leave History</h3>
        
        {loading ? (
          <div className="flex justify-center items-center py-10 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" /> Loading records...
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-[0.82rem]">
            No leave requests have been applied by you.
          </div>
        ) : (
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-2">
            {requests.map(req => (
              <div key={req.id} className="rounded-xl border border-border bg-surface/50 p-4 flex items-start justify-between gap-4">
                <div className="space-y-1.5 text-[0.82rem]">
                  <div className="font-bold text-[0.88rem] text-foreground">{req.leave_type}</div>
                  <div className="text-[0.72rem] text-muted-foreground">
                    Duration: <span className="font-semibold text-foreground">{req.from_date}</span> to <span className="font-semibold text-foreground">{req.to_date}</span>
                  </div>
                  <p className="text-muted-foreground italic">"{req.reason}"</p>
                </div>

                {(() => {
                  const statusNormalized = (req.status || 'pending').toLowerCase();
                  let badgeColors = "bg-zinc-500/20 text-zinc-400 border-zinc-500";
                  
                  if (statusNormalized === 'approved') {
                    badgeColors = "bg-green-500/20 text-green-400 border-green-500";
                  } else if (statusNormalized === 'pending') {
                    badgeColors = "bg-yellow-500/20 text-yellow-300 border-yellow-500";
                  } else if (statusNormalized === 'rejected') {
                    badgeColors = "bg-red-500/20 text-red-400 border-red-500";
                  }

                  return (
                    <span className={`rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider border ${badgeColors}`}>
                      {req.status}
                    </span>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 border-present text-present">
          <CheckCircle className="h-4 w-4" />
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default StudentLeave;