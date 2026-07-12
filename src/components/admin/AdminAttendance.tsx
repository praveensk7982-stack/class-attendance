import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStudentsByYear, MONTH_NAMES, countWorkingDays } from "@/data/students";
import { 
  Calendar,
  Search,
  Check,
  X,
  Clock,
  Save,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface DbStudent {
  id: string;
  name: string;
  register_number: string;
  class: string;
  department: string;
}

interface AttendanceState {
  status: 'present' | 'absent' | 'leave' | 'not-marked';
  isLate: boolean;
  saving?: boolean;
}

const AdminAttendance = () => {
  const todayStr = new Date().toISOString().split("T")[0];
  
  // Filters
  const [classYear, setClassYear] = useState("3rd Year");
  const [dept, setDept] = useState("Information Technology");
  const [date, setDate] = useState(todayStr);
  const [search, setSearch] = useState("");

  const [students, setStudents] = useState<DbStudent[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceState>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadStudentsAndAttendance = async () => {
    try {
      setLoading(true);
      // 1. Fetch Students matching filters
      // Using ilike instead of eq because the DB stores class as e.g. "3rd Year IT"
      // while this page's dropdown only sends "3rd Year" - ilike matches both.
      const { data: dbStudents, error: studentError } = await supabase
        .from("students")
        .select("id, name, register_number, class, department")
        .ilike("class", `${classYear}%`)
        .eq("department", dept);

      let activeStudents: DbStudent[] = [];
      if (!studentError) {
        // DB query succeeded — trust it completely, even if it's an empty array.
        // (Previously this also fell back to mock data when the array was empty,
        // which is why "1st Year" showed fake students that don't exist in the DB.)
        activeStudents = (dbStudents as DbStudent[]) || [];
      } else {
        // Fallback to local students list
        const stored = localStorage.getItem("local_students");
        if (stored) {
          const allLocal: DbStudent[] = JSON.parse(stored);
          activeStudents = allLocal.filter(s => s.class.startsWith(classYear) && s.department === dept);
        } else {
          const list = getStudentsByYear(classYear, dept);
          activeStudents = list.map(s => ({
            id: s.id.toString(),
            name: s.name,
            register_number: s.reg,
            class: classYear,
            department: dept
          }));
        }
      }
      setStudents(activeStudents);

      // 2. Fetch Attendance records for this date
      const { data: dbAttendance, error: attError } = await supabase
        .from("attendance")
        .select("student_id, status, is_late")
        .eq("date", date);

      const attState: Record<string, AttendanceState> = {};
      
      // Populate defaults
      activeStudents.forEach(s => {
        attState[s.id] = { status: 'not-marked', isLate: false };
      });

      // Override with DB values
      if (!attError && dbAttendance) {
        dbAttendance.forEach((row: any) => {
          if (attState[row.student_id]) {
            attState[row.student_id] = {
              status: row.status.toLowerCase() as any,
              isLate: row.is_late || false
            };
          }
        });
      } else {
        // Local storage fallback for attendance
        const localAtt = localStorage.getItem(`local_att_${date}`);
        if (localAtt) {
          const parsed = JSON.parse(localAtt);
          Object.keys(parsed).forEach(sid => {
            if (attState[sid]) {
              attState[sid] = parsed[sid];
            }
          });
        }
      }

      setAttendance(attState);
    } catch (err) {
      console.error("Failed to load attendance details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentsAndAttendance();
  }, [classYear, dept, date]);

  const markStatus = (studentId: string, status: 'present' | 'absent' | 'leave') => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
        // Automatically disable late-arrival if they are absent or on leave
        isLate: status === 'present' ? prev[studentId].isLate : false
      }
    }));
  };

  const toggleLate = (studentId: string) => {
    setAttendance(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isLate: !prev[studentId].isLate,
        // Automatically set status to present if they are marked late
        status: !prev[studentId].isLate ? 'present' : prev[studentId].status
      }
    }));
  };

  const handleSaveAll = async () => {
    setLoading(true);
    let successCount = 0;
    let localBackupState: Record<string, AttendanceState> = {};

    try {
      for (const student of students) {
        const state = attendance[student.id];
        if (!state || state.status === 'not-marked') continue;

        localBackupState[student.id] = state;

        // Try to save to Supabase
        // Step 1: Delete duplicate
        await supabase
          .from("attendance")
          .delete()
          .eq("student_id", student.id)
          .eq("date", date);

        // Step 2: Insert
        const { error } = await supabase
          .from("attendance")
          .insert({
            student_id: student.id,
            date,
            status: state.status,
            is_late: state.isLate
          });

        if (!error) successCount++;
      }

      // Sync local storage backups
      localStorage.setItem(`local_att_${date}`, JSON.stringify(localBackupState));
      
      // Update global local storage for student stats calculation offline
      const storedHistory = localStorage.getItem("local_att_history") || "[]";
      const historyList = JSON.parse(storedHistory);
      
      students.forEach(student => {
        const state = attendance[student.id];
        if (state && state.status !== 'not-marked') {
          // Remove duplicate in local history array
          const index = historyList.findIndex(
            (h: any) => h.student_id === student.id && h.date === date
          );
          if (index !== -1) historyList.splice(index, 1);
          
          historyList.push({
            student_id: student.id,
            register_number: student.register_number,
            date,
            status: state.status,
            is_late: state.isLate
          });
        }
      });
      localStorage.setItem("local_att_history", JSON.stringify(historyList));

      if (successCount === students.length) {
        triggerToast("All attendance records saved to Supabase database ✓", true);
      } else {
        triggerToast(`Attendance saved successfully! (Synced local state fallback) ✓`, true);
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error saving attendance details.", false);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || s.register_number.includes(search)
  );

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Attendance parameters layout */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-card p-6 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Class/Year</label>
          <select
            value={classYear}
            onChange={e => setClassYear(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
          >
            <option>1st Year</option>
            <option>2nd Year</option>
            <option>3rd Year</option>
            <option>4th Year</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Department</label>
          <select
            value={dept}
            onChange={e => setDept(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
          >
            <option>Information Technology</option>
            <option>Computer Science and Engineering</option>
            <option>Artificial Intelligence and Data Science</option>
            <option>Electronics and Communication Engineering</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Target Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={handleSaveAll}
            disabled={loading}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[0.82rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
          >
            <Save className="h-4.5 w-4.5" /> Save Attendance Sheet
          </button>
        </div>
      </div>

      {/* Search directory filter */}
      <div className="flex items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search student by name or reg no..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-[0.82rem] outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Daily Attendance marker table */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <LoaderSpinner /> Loading attendance records...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          No students match the criteria for this class & department.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface text-muted-foreground text-[0.72rem] font-bold uppercase tracking-wider border-b border-border/50">
                  <th className="px-6 py-4 text-left">Student</th>
                  <th className="px-6 py-4 text-left">Register Number</th>
                  <th className="px-6 py-4 text-center">Status Action</th>
                  <th className="px-6 py-4 text-center">Late Arrival Fine</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => {
                  const state = attendance[student.id] || { status: 'not-marked', isLate: false };
                  return (
                    <tr key={student.register_number} className="border-b border-border/40 hover:bg-surface/30 transition-all">
                      <td className="px-6 py-4 text-[0.88rem] font-bold">{student.name}</td>
                      <td className="px-6 py-4 text-[0.85rem] font-mono text-muted-foreground">{student.register_number}</td>
                      
                      {/* Mark Status Buttons */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => markStatus(student.id, 'present')}
                            className={`rounded-lg border px-3 py-1.5 text-[0.72rem] font-bold transition-all ${
                              state.status === 'present'
                                ? "bg-present/15 border-present text-present shadow-[0_0_8px_rgba(34,211,160,0.2)]"
                                : "border-border hover:border-present/50 hover:bg-present/5 text-muted-foreground"
                            }`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => markStatus(student.id, 'absent')}
                            className={`rounded-lg border px-3 py-1.5 text-[0.72rem] font-bold transition-all ${
                              state.status === 'absent'
                                ? "bg-absent/15 border-absent text-absent shadow-[0_0_8px_rgba(255,108,108,0.2)]"
                                : "border-border hover:border-absent/50 hover:bg-absent/5 text-muted-foreground"
                            }`}
                          >
                            A
                          </button>
                          <button
                            onClick={() => markStatus(student.id, 'leave')}
                            className={`rounded-lg border px-3 py-1.5 text-[0.72rem] font-bold transition-all ${
                              state.status === 'leave'
                                ? "bg-orange-400/15 border-orange-400 text-orange-400 shadow-[0_0_8px_rgba(251,191,36,0.2)]"
                                : "border-border hover:border-orange-400/50 hover:bg-orange-400/5 text-muted-foreground"
                            }`}
                          >
                            L
                          </button>
                        </div>
                      </td>

                      {/* Late Arrival Check */}
                      <td className="px-6 py-4 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.isLate}
                            onChange={() => toggleLate(student.id)}
                            disabled={state.status !== 'present' && state.status !== 'not-marked'}
                            className="h-4 w-4 rounded border-border bg-surface text-primary focus:ring-primary"
                          />
                          <span className={`text-[0.78rem] font-medium ${state.isLate ? "text-primary font-bold" : "text-muted-foreground"}`}>
                            {state.isLate ? "● Late Entry" : "On Time"}
                          </span>
                        </label>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 ${toast.success ? "border-present text-present" : "border-warn text-warn"}`}>
          {toast.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

const LoaderSpinner = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default AdminAttendance;