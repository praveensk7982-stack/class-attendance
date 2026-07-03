import { useState, useEffect } from "react";
import { getStudentsByYear, MONTH_NAMES, countWorkingDays, getMonthlyStats, getInitials, AttendanceRecord, Student, mergeDbProfiles } from "@/data/students";
import { supabase } from "@/integrations/supabase/client";
import { FilterData } from "./FilterPage";
import TopBar from "./TopBar";

interface StudentsPageProps {
  username: string;
  onLogout: () => void;
  filter: FilterData;
  attendance: AttendanceRecord;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord>>;
  onBack: () => void;
  onSelectStudent: (id: number) => void;
}

const StudentsPage = ({ username, onLogout, filter, attendance, setAttendance, onBack, onSelectStudent }: StudentsPageProps) => {
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [studentsList, setStudentsList] = useState<Student[]>(() =>
    getStudentsByYear(filter.studentYear, filter.dept)
  );

  const todayStr = new Date().toLocaleDateString("en-GB");
  const wd = countWorkingDays(filter.month);
  const filtered = studentsList.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.reg.includes(search)
  );

  // Load attendance and student profiles from database on mount
  useEffect(() => {
    const loadData = async () => {
      let activeStudents = getStudentsByYear(filter.studentYear, filter.dept);
      
      try {
        // Fetch profiles from database
        const { data: dbStudents, error: studentError } = await supabase
          .from("students")
          .select("id, name, register_number, department, designation, email, phone, joining_date, photo_url");

        if (!studentError && dbStudents && dbStudents.length > 0) {
          activeStudents = mergeDbProfiles(activeStudents, dbStudents);
          setStudentsList(activeStudents);
        }
      } catch (err) {
        console.error("Failed to load profiles from database:", err);
      }

      try {
        // Load attendance from database
        const { data, error } = await supabase
          .from("attendance")
          .select("student_id, date, status, students!inner(register_number)");

        if (error || !data) return;

        const dbAttendance: AttendanceRecord = { ...attendance };
        data.forEach((row: any) => {
          const localStudent = activeStudents.find(s => s.reg === row.students?.register_number);
          if (!localStudent) return;
          const dateStr = new Date(row.date).toLocaleDateString("en-GB");
          if (!dbAttendance[localStudent.id]) dbAttendance[localStudent.id] = {};
          dbAttendance[localStudent.id][dateStr] = row.status as 'present' | 'absent' | 'leave';
        });
        setAttendance(dbAttendance);
      } catch (err) {
        console.error("Failed to load attendance from database:", err);
      }
    };
    loadData();
  }, []);

  let tp = 0, ta = 0, tnm = 0;
  filtered.forEach(s => {
    const status = attendance[s.id]?.[filter.date];
    if (status === "present") tp++;
    else if (status === "absent") ta++;
    else tnm++;
  });

  const pills = [filter.sem, filter.dept, filter.studentYear, `Month: ${MONTH_NAMES[filter.month]}`, `Working Days: ${wd}`, `Date: ${filter.date}`];

  const showToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const handleQuickMark = async (studentId: number, status: 'present' | 'absent') => {
    setSaving(studentId);
    const student = studentsList.find(s => s.id === studentId);
    if (!student) return;

    // Find the DB student UUID
    const { data: dbStudent } = await supabase
      .from("students")
      .select("id")
      .eq("register_number", student.reg)
      .single();

    if (dbStudent) {
   const [day, month, year] = filter.date.split("/");
const dateISO = `${year}-${month}-${day}`;
     await supabase
  .from("attendance")
  .delete()
  .eq("student_id", dbStudent.id)
  .eq("date", dateISO);

await supabase
  .from("attendance")
  .insert(
    { student_id: dbStudent.id, date: dateISO, status }
  );
    }

    setAttendance(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [filter.date]: status }
    }));
    setSaving(null);
    showToast(`Marked ${status} for ${student.name} ✓`, true);
  };

  // Get previous 6 working days for the header
  const getPrevDays = () => {
    const days: string[] = [];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    while (days.length < 5) {
      if (d.getDay() !== 0) {
        days.push(d.toLocaleDateString("en-GB"));
      }
      d.setDate(d.getDate() - 1);
    }
    return days;
  };
  const prevDays = getPrevDays();

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <TopBar username={username} onLogout={onLogout} />
      <div className="mx-auto w-full max-w-[1200px] flex-1 p-8">
        <button onClick={onBack} className="mb-5 text-[0.82rem] text-muted-foreground transition-colors hover:text-primary">
          ← Back to Filters
        </button>

        <div className="mb-5 flex flex-wrap gap-2">
          {pills.map(p => (
            <span key={p} className="rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1 text-[0.78rem] font-medium text-primary">{p}</span>
          ))}
        </div>

        {/* Stats */}
        <div className="mb-6 flex flex-wrap gap-4">
          {[
            { label: "Total Students", val: filtered.length, color: "text-primary" },
            { label: "Today Present", val: tp, color: "text-present" },
            { label: "Today Absent", val: ta, color: "text-absent" },
            { label: "Not Marked", val: tnm, color: "text-yellow-400" },
            { label: `${MONTH_NAMES[filter.month]} Working Days`, val: wd, color: "text-primary" },
          ].map(s => (
            <div key={s.label} className="min-w-[120px] flex-1 rounded-xl border border-border bg-card px-6 py-4">
              <div className="text-[0.72rem] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className={`font-display text-[1.7rem] font-bold ${s.color}`}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
            <span className="font-display font-semibold">Student Records</span>
            <input
              type="text"
              placeholder="Search name or reg..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-60 rounded-lg border border-border bg-surface px-4 py-2 text-[0.85rem] text-foreground outline-none transition-all focus:border-primary"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface">
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Student</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Register No.</th>
                  <th className="whitespace-nowrap px-4 py-3 text-center text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Today</th>
                  {prevDays.map(d => (
                    <th key={d} className="whitespace-nowrap px-2 py-3 text-center text-[0.65rem] font-medium uppercase tracking-wider text-muted-foreground">{d.slice(0, 5)}</th>
                  ))}
                  <th className="whitespace-nowrap px-4 py-3 text-left text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const todayStatus = attendance[s.id]?.[filter.date] || "not-marked";
                  const { present } = getMonthlyStats(attendance, s.id, filter.month);
                  const pct = wd > 0 ? Math.round((present / wd) * 100) : 0;
                  const pctColor = pct < 75 ? "hsl(var(--absent))" : pct < 85 ? "#fbbf24" : "hsl(var(--present))";
                  const ini = getInitials(s.name);
                  const isCurrentlySaving = saving === s.id;

                  return (
                    <tr key={s.id} className="border-t border-border transition-colors hover:bg-primary/5">
                      <td className="whitespace-nowrap px-4 py-3 text-[0.85rem] cursor-pointer" onClick={() => onSelectStudent(s.id)}>
                        <span className="avatar-gradient mr-2 inline-flex h-[30px] w-[30px] items-center justify-center rounded-full align-middle text-[0.68rem] font-bold text-primary-foreground">{ini}</span>
                        {s.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[0.85rem]">{s.reg}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        {todayStatus === "not-marked" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              disabled={isCurrentlySaving}
                              onClick={(e) => { e.stopPropagation(); handleQuickMark(s.id, "present"); }}
                              className="rounded-md border border-present/30 bg-present/10 px-2.5 py-1 text-[0.7rem] font-semibold text-present transition-all hover:bg-present/20 disabled:opacity-50"
                            >P</button>
                            <button
                              disabled={isCurrentlySaving}
                              onClick={(e) => { e.stopPropagation(); handleQuickMark(s.id, "absent"); }}
                              className="rounded-md border border-absent/30 bg-absent/10 px-2.5 py-1 text-[0.7rem] font-semibold text-absent transition-all hover:bg-absent/20 disabled:opacity-50"
                            >A</button>
                          </div>
                        ) : (
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.72rem] font-medium ${todayStatus === "present" ? "bg-present/15 text-present" : "bg-absent/15 text-absent"}`}>
                            {todayStatus === "present" ? "● P" : "● A"}
                          </span>
                        )}
                      </td>
                      {prevDays.map(d => {
                        const st = attendance[s.id]?.[d];
                        return (
                          <td key={d} className="whitespace-nowrap px-2 py-3 text-center">
                            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[0.65rem] font-bold ${st === "present" ? "bg-present/15 text-present" : st === "absent" ? "bg-absent/15 text-absent" : "bg-muted/15 text-muted-foreground"}`}>
                              {st === "present" ? "P" : st === "absent" ? "A" : "—"}
                            </span>
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-border">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pctColor }} />
                          </div>
                          <span className="text-[0.75rem] font-semibold" style={{ color: pctColor }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Removed StudentModal */}

      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] ${toast.success ? "border-present text-present" : "border-border text-foreground"}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
