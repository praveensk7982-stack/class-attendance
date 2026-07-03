import { useState, useEffect } from "react";
import { Student, MONTH_NAMES, countWorkingDays, getMonthlyStats, getInitials, AttendanceRecord } from "@/data/students";
import { FilterData } from "./FilterPage";

interface StudentModalProps {
  student: Student;
  filter: FilterData;
  attendance: AttendanceRecord;
  onClose: () => void;
  onSave: (studentId: number, status: 'present' | 'absent') => void;
}

const StudentModal = ({ student, filter, attendance, onClose, onSave }: StudentModalProps) => {
  const currentMonth = new Date().getMonth();
  const [viewMonth, setViewMonth] = useState(filter.month);
  const [mark, setMark] = useState<'present' | 'absent' | null>(
    attendance[student.id]?.[filter.date] || null
  );

  const isViewingCurrentMonth = viewMonth === currentMonth;
  const wd = countWorkingDays(viewMonth);
  const { present, absent } = getMonthlyStats(attendance, student.id, viewMonth);
  const pct = wd > 0 ? Math.round((present / wd) * 100) : 0;
  const pctColor = pct < 75 ? "hsl(var(--absent))" : pct < 85 ? "#fbbf24" : "hsl(var(--present))";
  const ini = getInitials(student.name);
  const todayStatus = attendance[student.id]?.[filter.date];
  const todayStr = new Date().toLocaleDateString("en-GB");
  const isToday = filter.date === todayStr;
  const yr = new Date().getFullYear();
  const dim = new Date(yr, viewMonth + 1, 0).getDate();

  // Ring animation
  const circumference = 163.4;
  const [offset, setOffset] = useState(circumference);
  useEffect(() => {
    const timer = setTimeout(() => setOffset(circumference - (Math.min(pct, 100) / 100) * circumference), 100);
    return () => clearTimeout(timer);
  }, [pct]);

  const handleSave = () => {
    if (!mark) return;
    onSave(student.id, mark);
  };

  const days: { day: number; key: string; status: string | undefined }[] = [];
  for (let d = 1; d <= dim; d++) {
    const dd = new Date(yr, viewMonth, d);
    if (dd.getDay() === 0) continue;
    const key = dd.toLocaleDateString("en-GB");
    days.push({ day: d, key, status: attendance[student.id]?.[key] });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="animate-slide-up-fast my-auto w-full max-w-[600px] overflow-hidden rounded-[20px] border border-border bg-card shadow-[0_40px_100px_rgba(0,0,0,.5)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border bg-gradient-to-br from-primary/10 to-accent/5 px-8 py-6">
          <div>
            <div className="avatar-gradient mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] text-xl font-bold text-primary-foreground">{ini}</div>
            <h2 className="font-display text-xl font-bold">{student.name}</h2>
            <p className="text-[0.83rem] text-muted-foreground">{student.dept} · {filter.sem} · Viewing: {MONTH_NAMES[viewMonth]}</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:border-warn hover:text-warn">✕</button>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {/* Details */}
          <div className="mb-5 grid grid-cols-2 gap-4">
            {[
              { label: "Register No.", val: student.reg },
              { label: "Department", val: student.dept },
              { label: "Date", val: filter.date },
              { label: "Month", val: `${MONTH_NAMES[viewMonth]} ${yr}` },
            ].map(d => (
              <div key={d.label}>
                <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{d.label}</span>
                <p className="text-[0.88rem]">{d.val}</p>
              </div>
            ))}
          </div>

          <div className="mb-1 h-px bg-border" />

          {/* Month Navigation */}
          <div className="mb-4 mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-2.5">
            <button
              onClick={() => setViewMonth(m => Math.max(0, m - 1))}
              disabled={viewMonth === 0}
              className="rounded-md border border-border px-3 py-1 text-[0.8rem] font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-30"
            >← Prev</button>
            <span className="font-display text-[0.88rem] font-semibold">
              {MONTH_NAMES[viewMonth]} {yr}
              {isViewingCurrentMonth && <span className="ml-2 rounded-full bg-present/15 px-2 py-0.5 text-[0.65rem] text-present">Current</span>}
            </span>
            <button
              onClick={() => setViewMonth(m => Math.min(currentMonth, m + 1))}
              disabled={viewMonth >= currentMonth}
              className="rounded-md border border-border px-3 py-1 text-[0.8rem] font-medium text-muted-foreground transition-all hover:border-primary hover:text-primary disabled:opacity-30"
            >Next →</button>
          </div>

          {/* Monthly Summary */}
          <h3 className="mb-3 font-display text-[0.88rem] font-semibold">📊 {MONTH_NAMES[viewMonth]} Attendance Summary</h3>
          <div className="mb-5 grid grid-cols-4 gap-2.5 max-[600px]:grid-cols-2">
            {[
              { label: "Working Days", val: wd, cls: "text-primary" },
              { label: "Days Present", val: present, cls: "text-present" },
              { label: "Days Absent", val: absent, cls: "text-absent" },
              { label: "Attendance %", val: `${pct}%`, cls: pct < 75 ? "text-absent" : pct < 85 ? "text-yellow-400" : "text-present" },
            ].map(m => (
              <div key={m.label} className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className={`font-display text-[1.45rem] font-bold ${m.cls}`}>{m.val}</div>
                <div className="mt-1 text-[0.65rem] uppercase tracking-wider text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>

          {/* Ring */}
          <div className="mb-4 flex items-center gap-5 rounded-xl border border-border bg-surface p-4">
            <svg width="60" height="60" viewBox="0 0 60 60">
              <circle cx="30" cy="30" r="26" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
              <circle
                cx="30" cy="30" r="26" fill="none"
                stroke={pctColor}
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div>
              <div className="font-display text-2xl font-bold" style={{ color: pctColor }}>{pct}%</div>
              <div className="text-[0.78rem] text-muted-foreground">{present} present out of {wd} working days</div>
              <div className="mt-1 text-[0.75rem] font-medium" style={{ color: pctColor }}>
                {pct < 75 ? "⚠ Below 75% — Attendance shortage!" : pct < 85 ? "↗ Needs improvement" : "✓ Good attendance"}
              </div>
            </div>
          </div>

          {/* Today status - only show for current month */}
          {isViewingCurrentMonth && (
            <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3">
              <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${todayStatus === "present" ? "bg-present shadow-[0_0_6px_hsl(var(--present))]" : todayStatus === "absent" ? "bg-absent shadow-[0_0_6px_hsl(var(--absent))]" : "bg-muted-foreground"}`} />
              <span className="text-[0.85rem]">
                Today ({filter.date}): {todayStatus === "present" ? "Present ✓" : todayStatus === "absent" ? "Absent ✗" : "Not yet marked"}
              </span>
            </div>
          )}

          <div className="mb-1 h-px bg-border" />

          {/* Mark Attendance - only for current month & today */}
          {isViewingCurrentMonth && (
            <>
              <h3 className="mb-3 mt-4 font-display text-[0.88rem] font-semibold">✏️ Mark Attendance</h3>
              {isToday ? (
                <div className="mb-4 flex gap-3">
                  <button
                    onClick={() => setMark("present")}
                    className={`flex-1 rounded-lg border-2 py-3 font-display text-[0.92rem] font-semibold transition-all ${mark === "present" ? "border-present bg-present/10 text-present" : "border-border text-muted-foreground hover:border-present hover:bg-present/10 hover:text-present"}`}
                  >✓ Present</button>
                  <button
                    onClick={() => setMark("absent")}
                    className={`flex-1 rounded-lg border-2 py-3 font-display text-[0.92rem] font-semibold transition-all ${mark === "absent" ? "border-absent bg-absent/10 text-absent" : "border-border text-muted-foreground hover:border-absent hover:bg-absent/10 hover:text-absent"}`}
                  >✗ Absent</button>
                </div>
              ) : (
                <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-center text-[0.82rem] text-muted-foreground">
                  🔒 Attendance can only be marked for today's date
                </div>
              )}
            </>
          )}

          {!isViewingCurrentMonth && (
            <div className="mb-4 mt-4 rounded-lg border border-border bg-surface px-4 py-3 text-center text-[0.82rem] text-muted-foreground">
              📖 Viewing {MONTH_NAMES[viewMonth]} attendance (read-only)
            </div>
          )}

          {/* Day-by-day calendar */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="mb-3 text-[0.72rem] uppercase tracking-wider text-muted-foreground">{MONTH_NAMES[viewMonth]} — Day by Day</div>
            <div className="flex flex-wrap gap-1.5">
              {days.map(d => (
                <div
                  key={d.key}
                  title={`${d.key}: ${d.status || "not marked"}`}
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-[0.62rem] font-semibold ${d.status === "present" ? "bg-present/20 text-present" : d.status === "absent" ? "bg-absent/20 text-absent" : "bg-border text-muted-foreground"}`}
                >{d.day}</div>
              ))}
            </div>
          </div>

          {isToday && isViewingCurrentMonth && (
            <button
              onClick={handleSave}
              className="btn-save-gradient mt-4 w-full rounded-lg py-3.5 font-display text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:opacity-90"
            >Save Attendance</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentModal;
