import { useState, useEffect } from "react";
import { Student, MONTH_NAMES, countWorkingDays, getMonthlyStats, AttendanceRecord } from "@/data/students";
import { FilterData } from "./FilterPage";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Calendar, 
  Briefcase, 
  Building, 
  Clock, 
  CalendarCheck, 
  AlertCircle,
  Sparkles,
  CheckCircle,
  XCircle,
  FileText
} from "lucide-react";

interface EmployeeProfilePageProps {
  username: string;
  onLogout: () => void;
  student: Student;
  filter: FilterData;
  attendance: AttendanceRecord;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord>>;
  onBack: () => void;
}

const LeaveTypes = [
  "Sick Leave",
  "Casual Leave",
  "Earned Leave",
  "Maternity/Paternity Leave",
  "Unpaid Leave"
];

const EmployeeProfilePage = ({
  username,
  onLogout,
  student,
  filter,
  attendance,
  setAttendance,
  onBack
}: EmployeeProfilePageProps) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const [viewMonth, setViewMonth] = useState(filter.month);
  const [viewYear, setViewYear] = useState(currentYear);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  // Form states
  const [leaveType, setLeaveType] = useState(LeaveTypes[0]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const showToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 4000);
  };

  // Get monthly stats
  const { present, absent, leave } = getMonthlyStats(attendance, student.id, viewMonth);
  const wd = countWorkingDays(viewMonth);
  
  // Calculate attendance percentage
  const pct = wd > 0 ? Math.round((present / wd) * 100) : 0;
  const pctColor = pct < 75 ? "hsl(var(--absent))" : pct < 85 ? "#fbbf24" : "hsl(var(--present))";

  // Ring offset calculation
  const circumference = 163.4; // 2 * pi * r (r=26)
  const [offset, setOffset] = useState(circumference);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (Math.min(pct, 100) / 100) * circumference);
    }, 100);
    return () => clearTimeout(timer);
  }, [pct]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const calendarDays: { day: number; dateStr: string; status: 'present' | 'absent' | 'leave' | 'not-marked'; dayOfWeek: number }[] = [];
  
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(viewYear, viewMonth, d);
    if (dateObj.getDay() === 0) continue; // Skip Sunday
    const dateStr = dateObj.toLocaleDateString("en-GB");
    const status = attendance[student.id]?.[dateStr] || "not-marked";
    calendarDays.push({
      day: d,
      dateStr,
      status,
      dayOfWeek: dateObj.getDay()
    });
  }

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromDate || !toDate || !reason.trim()) {
      setFormError("All fields are required.");
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (end < start) {
      setFormError("To Date must be after or equal to From Date.");
      return;
    }

    setSubmittingLeave(true);
    setFormError("");

    // Calculate all dates in range (excluding Sundays)
    const datesToMark: string[] = []; // YYYY-MM-DD
    const localDatesToMark: string[] = []; // DD/MM/YYYY

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === 0) continue; // Skip Sundays
      
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const yr = d.getFullYear();
      
      datesToMark.push(`${yr}-${month}-${day}`);
      localDatesToMark.push(`${day}/${month}/${yr}`);
    }

    if (datesToMark.length === 0) {
      setFormError("The selected date range contains no working days.");
      setSubmittingLeave(false);
      return;
    }

    try {
      // Find the DB student UUID
      const { data: dbStudent } = await supabase
        .from("students")
        .select("id, name")
        .eq("register_number", student.reg)
        .single();

      if (dbStudent) {
        // Delete existing attendance records for these dates
        for (const dateISO of datesToMark) {
          await supabase
            .from("attendance")
            .delete()
            .eq("student_id", dbStudent.id)
            .eq("date", dateISO);
        }

        // Insert leave records
        const inserts = datesToMark.map(dateISO => ({
          student_id: dbStudent.id,
          date: dateISO,
          status: "leave"
        }));

        await supabase.from("attendance").insert(inserts);
      }
// Send WhatsApp notification to HOD/Class Advisor
      try {
        await fetch(
          `https://ikicnjrjvtnszwzkuybo.supabase.co/functions/v1/send-leave-whatsapp`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json",
               "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
            body: JSON.stringify({
              employeeName: student.name,
              leaveType: leaveType,
              fromDate: fromDate,
              toDate: toDate,
              reason: reason,
            }),
          }
        );
      } catch (whatsappErr) {
        console.error("WhatsApp notification failed:", whatsappErr);
      }
      // Update local state
      setAttendance(prev => {
        const studentRec = prev[student.id] ? { ...prev[student.id] } : {};
        localDatesToMark.forEach(dateStr => {
          studentRec[dateStr] = 'leave';
        });
        return {
          ...prev,
          [student.id]: studentRec
        };
      });

      // Clear form and close modal
      setFromDate("");
      setToDate("");
      setReason("");
      setShowLeaveForm(false);
      showToast(`Leave application approved and processed for ${datesToMark.length} working day(s) ✓`, true);

    } catch (err) {
      console.error("Failed to submit leave application:", err);
      showToast("Failed to process leave application. Please try again.", false);
    } finally {
      setSubmittingLeave(false);
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen flex-col pb-16">
      {/* Top Header */}
      <div className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-8 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:bg-card hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-gradient">Employee Profile</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-full border border-border bg-card px-4 py-1.5 text-[0.82rem] text-muted-foreground">
            Logged in as — <span className="font-medium text-foreground">{username}</span>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-border px-3 py-1.5 text-[0.8rem] text-muted-foreground transition-all hover:border-warn hover:text-warn"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Profile Content */}
      <div className="mx-auto w-full max-w-[1100px] flex-1 p-6 md:p-8">
        
        {/* Profile Card Hero */}
        <div className="mb-8 overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
          <div className="h-28 bg-gradient-to-r from-primary/20 via-accent/15 to-primary/10" />
          <div className="relative px-8 pb-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
              {/* Photo */}
              <div className="relative -mt-14 h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-surface shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
                <img 
                  src={student.photo_url || student.photo} 
                  alt={student.name}
                  className="h-full w-full object-cover"
                />
              </div>
              
              {/* Profile header stats */}
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-2xl font-bold">{student.name}</h2>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[0.72rem] font-semibold text-primary uppercase tracking-wider border border-primary/20">
                    Active
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[0.88rem] text-muted-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-primary" />
                  {student.designation}
                </p>
                <p className="mt-1 text-[0.78rem] text-muted-foreground">
                  Employee ID: <span className="font-medium text-foreground">{student.reg}</span>
                </p>
              </div>

              {/* Leave Application Button */}
              <div className="mt-4 sm:mt-0">
                <button
                  onClick={() => setShowLeaveForm(true)}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-[0.92rem] font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-[0_4px_16px_rgba(79,156,249,0.3)] hover:-translate-y-0.5"
                >
                  <FileText className="h-4.5 w-4.5" />
                  Leave Application
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Two Column Details Panel */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* Details & Info (1 column) */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="mb-5 font-display text-[0.95rem] font-bold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-primary" /> Personal Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[0.7rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Building className="h-3 w-3" /> Department
                  </label>
                  <p className="mt-0.5 text-[0.9rem] font-medium">{student.dept}</p>
                </div>

                <div>
                  <label className="text-[0.7rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3 w-3" /> Email Address
                  </label>
                  <p className="mt-0.5 text-[0.9rem] font-medium text-primary hover:underline cursor-pointer">
                    {student.email}
                  </p>
                </div>

                <div>
                  <label className="text-[0.7rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3" /> Phone Number
                  </label>
                  <p className="mt-0.5 text-[0.9rem] font-medium">{student.phone}</p>
                </div>

                <div>
                  <label className="text-[0.7rem] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" /> Date of Joining
                  </label>
                  <p className="mt-0.5 text-[0.9rem] font-medium">
                    {new Date(student.joining_date || student.joiningDate || "").toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Circular Progress Gauge */}
            <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center">
              <h3 className="mb-4 self-start font-display text-[0.95rem] font-bold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4.5 w-4.5 text-accent" /> Performance Gauge
              </h3>

              <div className="relative my-4 flex h-32 w-32 items-center justify-center">
                <svg width="120" height="120" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="hsl(var(--border))" strokeWidth="4.5" />
                  <circle
                    cx="30" cy="30" r="26" fill="none"
                    stroke={pctColor}
                    strokeWidth="4.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-display text-2xl font-bold" style={{ color: pctColor }}>{pct}%</span>
                  <span className="text-[0.62rem] uppercase tracking-wide text-muted-foreground">Attendance</span>
                </div>
              </div>
              
              <div className="mt-2 text-[0.8rem] text-muted-foreground">
                {pct < 75 ? (
                  <span className="font-semibold text-absent flex items-center justify-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" /> Attendance shortage (Below 75%)
                  </span>
                ) : pct < 85 ? (
                  <span className="font-semibold text-yellow-400">Average — Needs Improvement</span>
                ) : (
                  <span className="font-semibold text-present flex items-center justify-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Excellent Attendance Record
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats & Calendar (2 columns) */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            
            {/* Stats row */}
            <div className="grid grid-cols-4 gap-4 max-[600px]:grid-cols-2">
              {[
                { label: "Working Days", val: wd, color: "text-primary", icon: <CalendarCheck className="h-5 w-5 text-primary/70" /> },
                { label: "Present Days", val: present, color: "text-present", icon: <CheckCircle className="h-5 w-5 text-present/70" /> },
                { label: "Absent Days", val: absent, color: "text-absent", icon: <XCircle className="h-5 w-5 text-absent/70" /> },
                { label: "On Leave", val: leave, color: "text-orange-400", icon: <FileText className="h-5 w-5 text-orange-400/70" /> },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
                  <div>
                    <div className="text-[0.68rem] uppercase tracking-wider text-muted-foreground font-medium">{stat.label}</div>
                    <div className={`mt-1 font-display text-[1.6rem] font-bold ${stat.color}`}>{stat.val}</div>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-surface border border-border flex items-center justify-center">
                    {stat.icon}
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar display */}
            <div className="rounded-2xl border border-border bg-card p-6 flex-1">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-[1.1rem] font-bold">Attendance Calendar</h3>
                  <p className="text-[0.8rem] text-muted-foreground">View and trace detailed attendance status</p>
                </div>
                
                {/* Month Navigator */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-1.5">
                  <button
                    onClick={() => setViewMonth(m => Math.max(0, m - 1))}
                    disabled={viewMonth === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:text-foreground disabled:opacity-30"
                  >
                    ←
                  </button>
                  <span className="min-w-[110px] text-center font-display text-[0.82rem] font-semibold text-foreground">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </span>
                  <button
                    onClick={() => setViewMonth(m => Math.min(currentMonth, m + 1))}
                    disabled={viewMonth >= currentMonth}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all hover:text-foreground disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Status legend */}
              <div className="mb-5 flex flex-wrap gap-4 text-[0.78rem] text-muted-foreground border-b border-border/50 pb-4">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-present" /> Present</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-absent" /> Absent</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-orange-400" /> On Leave</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-border" /> Not Marked / Holiday</span>
              </div>

              {/* Day-by-Day Calendar Grid */}
              <div className="grid grid-cols-7 gap-2.5 text-center">
                {/* Week headers */}
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                  <div key={d} className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground py-1">
                    {d}
                  </div>
                ))}

                {/* Pad days for correct starting day of week */}
                {Array.from({ length: (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7 }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-10" />
                ))}

                {/* Calendar Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateObj = new Date(viewYear, viewMonth, dayNum);
                  const isSunday = dateObj.getDay() === 0;
                  const dateStr = dateObj.toLocaleDateString("en-GB");
                  
                  const status = isSunday ? "holiday" : (attendance[student.id]?.[dateStr] || "not-marked");
                  
                  let bgClass = "bg-surface text-muted-foreground border-border/40 hover:border-primary/20";
                  if (status === "present") bgClass = "bg-present/15 text-present border-present/30 font-semibold shadow-[0_0_8px_rgba(34,211,160,0.1)]";
                  if (status === "absent") bgClass = "bg-absent/15 text-absent border-absent/30 font-semibold shadow-[0_0_8px_rgba(255,108,108,0.1)]";
                  if (status === "leave") bgClass = "bg-orange-400/15 text-orange-400 border-orange-400/30 font-semibold shadow-[0_0_8px_rgba(251,191,36,0.1)]";
                  if (status === "holiday") bgClass = "bg-muted/10 text-muted-foreground/45 border-transparent opacity-60";

                  return (
                    <div
                      key={`day-${dayNum}`}
                      title={`${dateStr}${isSunday ? " (Sunday)" : `: ${status}`}`}
                      className={`flex h-10 items-center justify-center rounded-lg border text-[0.82rem] transition-all ${bgClass}`}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Leave Application Modal overlay */}
      {showLeaveForm && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={e => e.target === e.currentTarget && setShowLeaveForm(false)}
        >
          <div className="animate-slide-up-fast w-full max-w-[500px] overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_40px_100px_rgba(0,0,0,.6)]">
            
            {/* Form Header */}
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-br from-primary/10 to-accent/5 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold">Apply for Leave</h3>
                <p className="text-[0.78rem] text-muted-foreground">Request leave for {student.name}</p>
              </div>
              <button 
                onClick={() => setShowLeaveForm(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:border-warn hover:text-warn"
              >
                ✕
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleLeaveSubmit} className="p-6">
              
              <div className="space-y-4">
                
                {/* Leave Type */}
                <div>
                  <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">Leave Type</label>
                  <select 
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
                  >
                    {LeaveTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Date range grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">From Date</label>
                    <input 
                      type="date"
                      value={fromDate}
                      onChange={e => setFromDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">To Date</label>
                    <input 
                      type="date"
                      value={toDate}
                      onChange={e => setToDate(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary"
                    />
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">Reason for Leave</label>
                  <textarea 
                    rows={4}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Provide a brief reason for your leave request..."
                    className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary"
                  />
                </div>

              </div>

              {formError && (
                <p className="mt-4 text-[0.8rem] text-warn flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {formError}
                </p>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border/50 pt-4">
                <button
                  type="button"
                  onClick={() => setShowLeaveForm(false)}
                  className="rounded-lg border border-border bg-surface px-4 py-2.5 text-[0.88rem] font-semibold transition-all hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="btn-gradient flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-[0.88rem] font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
                >
                  {submittingLeave ? "Submitting..." : "Submit Application"}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Success/Error Toast notification */}
      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 ${toast.success ? "border-present text-present" : "border-warn text-warn"}`}>
          {toast.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default EmployeeProfilePage;
