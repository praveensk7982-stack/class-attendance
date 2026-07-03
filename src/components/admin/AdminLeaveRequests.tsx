import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LeaveRequest } from "@/data/students";
import { 
  Check, 
  X, 
  Calendar, 
  FileText, 
  Loader2, 
  User, 
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";

const AdminLeaveRequests = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      // Fetch leave requests joined with student details
      const { data: dbData, error } = await supabase
        .from("leave_requests")
        .select(`
          id,
          student_id,
          leave_type,
          from_date,
          to_date,
          reason,
          status,
          created_at,
          students (
            name,
            register_number
          )
        `);

      if (!error && dbData) {
        const mappedList: LeaveRequest[] = dbData.map((item: any) => ({
          id: item.id,
          student_id: item.student_id,
          student_name: item.students?.name || "Unknown Student",
          register_number: item.students?.register_number || "N/A",
          leave_type: item.leave_type,
          from_date: item.from_date,
          to_date: item.to_date,
          reason: item.reason,
          status: item.status as any,
          created_at: item.created_at
        }));
        // Sort requests: Pending first, then by date descending
        mappedList.sort((a, b) => {
          if (a.status === 'Pending' && b.status !== 'Pending') return -1;
          if (a.status !== 'Pending' && b.status === 'Pending') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setRequests(mappedList);
      } else {
        // Fallback to local storage list
        const stored = localStorage.getItem("local_leave_requests");
        if (stored) {
          setRequests(JSON.parse(stored));
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
    fetchLeaveRequests();
  }, []);

  const handleAction = async (id: string, action: 'Approved' | 'Rejected') => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    try {
      // 1. Update status in database
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: action })
        .eq("id", id);

      if (!error) {
        // Log action in leave_audit_logs
        try {
          await supabase.from("leave_audit_logs").insert({
            request_id: id,
            student_id: request.student_id,
            action: action,
            performed_by: 'Admin (Dashboard)',
            details: `Dashboard review action: ${action.toLowerCase()}`
          });
        } catch (errLog) {
          console.error("Audit log creation failed:", errLog);
        }
        // If approved, mark attendance records as 'leave' in database
        if (action === 'Approved') {
          const start = new Date(request.from_date);
          const end = new Date(request.to_date);
          const dates: string[] = [];

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            if (d.getDay() === 0) continue; // Skip Sundays
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const yr = d.getFullYear();
            dates.push(`${yr}-${month}-${day}`);
          }

          // Delete duplicates and insert leave records in public.attendance
          for (const dateISO of dates) {
            await supabase
              .from("attendance")
              .delete()
              .eq("student_id", request.student_id)
              .eq("date", dateISO);

            await supabase
              .from("attendance")
              .insert({
                student_id: request.student_id,
                date: dateISO,
                status: "leave",
                is_late: false
              });
          }
        }

        triggerToast(`Leave request ${action.toLowerCase()} successfully! ✓`, true);
        fetchLeaveRequests();
      } else {
        // Fallback update in LocalStorage
        const stored = localStorage.getItem("local_leave_requests");
        if (stored) {
          const list: LeaveRequest[] = JSON.parse(stored);
          const updated = list.map(item => {
            if (item.id === id) {
              return { ...item, status: action };
            }
            return item;
          });
          localStorage.setItem("local_leave_requests", JSON.stringify(updated));
          setRequests(updated);
          
          // Fallback update local attendance history
          if (action === 'Approved') {
            const start = new Date(request.from_date);
            const end = new Date(request.to_date);
            const history = JSON.parse(localStorage.getItem("local_att_history") || "[]");

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              if (d.getDay() === 0) continue;
              const dateStr = d.toLocaleDateString("en-GB");
              const dateISO = d.toISOString().split("T")[0];
              
              // Remove duplicate in local history array
              const idx = history.findIndex((h: any) => h.student_id === request.student_id && h.date === dateISO);
              if (idx !== -1) history.splice(idx, 1);
              
              history.push({
                student_id: request.student_id,
                register_number: request.register_number,
                date: dateISO,
                status: 'leave',
                is_late: false
              });
              
              // Also update specific date-key local attendance states
              const dailyKey = `local_att_${dateISO}`;
              const dailyData = JSON.parse(localStorage.getItem(dailyKey) || "{}");
              dailyData[request.student_id] = { status: 'leave', isLate: false };
              localStorage.setItem(dailyKey, JSON.stringify(dailyData));
            }
            localStorage.setItem("local_att_history", JSON.stringify(history));
          }

          triggerToast(`Leave request ${action.toLowerCase()} locally ✓`, true);
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast("An error occurred executing leave status update.", false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Loading leave applications...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          No leave applications have been submitted yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {requests.map(req => (
            <div 
              key={req.id} 
              className={`rounded-2xl border bg-card p-6 shadow-md transition-all ${
                req.status === 'Pending' 
                  ? "border-primary/20 bg-gradient-to-r from-card to-primary/5" 
                  : "border-border"
              }`}
            >
              {/* Card Header info */}
              <div className="flex justify-between items-start gap-3 border-b border-border/40 pb-4 mb-4">
                <div>
                  <h4 className="font-display font-bold text-[0.95rem] flex items-center gap-1.5 text-foreground">
                    <User className="h-4.5 w-4.5 text-primary" /> {req.student_name}
                  </h4>
                  <span className="text-[0.7rem] text-muted-foreground">Reg No: {req.register_number}</span>
                </div>
                
                {/* Status Badges */}
                <span className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                  req.status === 'Approved' 
                    ? "bg-present/15 text-present border border-present/20" 
                    : req.status === 'Rejected' 
                    ? "bg-absent/15 text-absent border border-absent/20" 
                    : "bg-yellow-400/15 text-yellow-400 border border-yellow-400/20"
                }`}>
                  {req.status}
                </span>
              </div>

              {/* Leave request details */}
              <div className="space-y-2.5 text-[0.82rem] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span>Leave Type: <strong className="text-foreground">{req.leave_type}</strong></span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    Range: <strong className="text-foreground">{req.from_date}</strong> to <strong className="text-foreground">{req.to_date}</strong>
                  </span>
                </div>

                <div className="bg-surface/50 rounded-xl p-3 border border-border/30 text-foreground leading-relaxed mt-2 italic">
                  "{req.reason}"
                </div>
              </div>

              {/* Action Buttons for Pending leaves */}
              {req.status === 'Pending' && (
                <div className="flex justify-end gap-2.5 border-t border-border/40 pt-4 mt-5">
                  <button
                    onClick={() => handleAction(req.id, 'Rejected')}
                    className="flex items-center gap-1.5 rounded-lg border border-absent/30 bg-absent/10 hover:bg-absent/20 px-3.5 py-1.5 text-[0.78rem] font-bold text-absent transition-all"
                  >
                    <X className="h-4 w-4" /> Reject
                  </button>
                  
                  <button
                    onClick={() => handleAction(req.id, 'Approved')}
                    className="flex items-center gap-1.5 rounded-lg border border-present/30 bg-present/10 hover:bg-present/20 px-3.5 py-1.5 text-[0.78rem] font-bold text-present transition-all"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 ${toast.success ? "border-present text-present" : "border-warn text-warn"}`}>
          {toast.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AdminLeaveRequests;
