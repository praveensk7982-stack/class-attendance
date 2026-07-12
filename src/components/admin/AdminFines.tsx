import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStudentsByYear } from "@/data/students";
import { 
  Settings, 
  DollarSign, 
  Loader2, 
  Check, 
  X, 
  TrendingDown, 
  RefreshCw,
  Sliders,
  Award,
  Plus,
  Search
} from "lucide-react";

interface FineRow {
  student_id: string;
  name: string;
  register_number: string;
  class: string;
  late_days: number;
  absent_days: number;
  late_fine: number;
  absent_fine: number;
  total_fine: number;
  payment_status: 'Paid' | 'Unpaid';
  fine_record_id?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const AdminFines = () => {
  const [finesList, setFinesList] = useState<FineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Settings rates defaults
  const [lateRate, setLateRate] = useState(50);
  const [leaveRate, setLeaveRate] = useState(500);
  const [updatingRates, setUpdatingRates] = useState(false);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFinesAndSettings = async () => {
    try {
      setLoading(true);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // 1. Fetch Fine Settings
      const { data: dbSettings, error: errSettings } = await supabase
        .from("fine_settings")
        .select("late_fine_rate, leave_fine_rate")
        .limit(1);

      let lRate = 50;
      let lvRate = 500;

      if (!errSettings && dbSettings && dbSettings.length > 0) {
        lRate = Number(dbSettings[0].late_fine_rate);
        lvRate = Number(dbSettings[0].leave_fine_rate);
        setLateRate(lRate);
        setLeaveRate(lvRate);
      } else {
        const storedRates = localStorage.getItem("local_fine_rates");
        if (storedRates) {
          const rates = JSON.parse(storedRates);
          lRate = rates.late_fine_rate || 50;
          lvRate = rates.leave_fine_rate || 500;
          setLateRate(lRate);
          setLeaveRate(lvRate);
        }
      }

      // 2. Fetch Students
      const { data: dbStudents } = await supabase
        .from("students")
        .select("id, name, register_number, class");

      let activeStudents: any[] = [];
      if (dbStudents && dbStudents.length > 0) {
        activeStudents = dbStudents;
      } else {
        const stored = localStorage.getItem("local_students");
        if (stored) {
          activeStudents = JSON.parse(stored);
        } else {
          activeStudents = getStudentsByYear("3rd Year").map(s => ({
            id: s.id.toString(),
            name: s.name,
            register_number: s.reg,
            class: "3rd Year"
          }));
        }
      }

      // 3. Fetch Attendance History to count absent days
      const { data: dbAtt } = await supabase
        .from("attendance")
        .select("student_id, status, is_late");

      let attendanceList: any[] = [];
      if (dbAtt) {
        attendanceList = dbAtt;
      } else {
        attendanceList = JSON.parse(localStorage.getItem("local_att_history") || "[]");
      }

      // 4. Fetch Manual Interval Fine logs from database
      let dbLogs: any[] = [];
      try {
        const { data } = await supabase
          .from("leave_audit_logs")
          .select("student_id, details, created_at");
        if (data) dbLogs = data;
      } catch (errLogs) {
        console.warn("Could not fetch audit logs:", errLogs);
      }

      // 5. Fetch Student Fines Payment Statuses
      const { data: dbFines } = await supabase
        .from("student_fines")
        .select("id, student_id, payment_status")
        .eq("month", currentMonth)
        .eq("year", currentYear);

      let localFines: any[] = [];
      if (dbFines) {
        localFines = dbFines;
      } else {
        localFines = JSON.parse(localStorage.getItem(`local_fines_${currentMonth}_${currentYear}`) || "[]");
      }

      // 6. Calculate fine per student
      const calculatedList: FineRow[] = activeStudents.map(student => {
        const records = attendanceList.filter(a => a.student_id === student.id);
        
        // Count manual late entries in the current month/year
        const studentLogs = dbLogs.filter(log => {
          const logDate = new Date(log.created_at);
          return log.student_id === student.id && 
                 logDate.getMonth() === currentMonth && 
                 logDate.getFullYear() === currentYear &&
                 log.details && log.details.includes("Manual Fine: Interval Fine");
        });

        // Add local count fallback
        const localKeyLate = `local_manual_interval_fines_${student.id}`;
        const localCountLate = Number(localStorage.getItem(localKeyLate) || "0");
        const lateDays = studentLogs.length + localCountLate;
        
        // Count absent days (Absent fine is automatic per day)
        const absentDays = records.filter(r => r.status.toLowerCase() === 'absent').length;

        // Count manual absent fine logs/adjustments
        const studentAbsentLogs = dbLogs.filter(log => {
          const logDate = new Date(log.created_at);
          return log.student_id === student.id && 
                 logDate.getMonth() === currentMonth && 
                 logDate.getFullYear() === currentYear;
        });

        let abFine = absentDays * 500;
        
        // Sort chronologically to apply adjustments correctly
        studentAbsentLogs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        for (const log of studentAbsentLogs) {
          if (log.details) {
            if (log.details.includes("Manual Fine: Absent Fine added by Admin")) {
              abFine += 500;
            } else if (log.details.includes("Manual Adjustment: Absent Fine set to")) {
              const match = log.details.match(/set to (\d+)/);
              if (match) {
                abFine = parseInt(match[1], 10);
              }
            } else if (log.details.includes("Manual Adjustment: Absent Fine removed")) {
              abFine = 0;
            }
          }
        }

        // Apply LocalStorage override fallback
        const localAdjKey = `local_manual_absent_fine_adj_${student.id}`;
        const localAdj = localStorage.getItem(localAdjKey);
        if (localAdj !== null) {
          abFine = parseInt(localAdj, 10);
        }

        // Fines calculation (Interval fine ₹50 manual)
        const lFine = lateDays * 50; 
        const total = lFine + abFine;

        // Payment status
        const payRec = localFines.find(f => f.student_id === student.id);
        const status = payRec ? payRec.payment_status : 'Unpaid';

        return {
          student_id: student.id,
          name: student.name,
          register_number: student.register_number,
          class: student.class,
          late_days: lateDays,
          absent_days: absentDays,
          late_fine: lFine,
          absent_fine: abFine,
          total_fine: total,
          payment_status: status as any,
          fine_record_id: payRec?.id
        };
      });

      setFinesList(calculatedList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinesAndSettings();
  }, []);

  const handleUpdateRates = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingRates(true);

    try {
      const { data: dbSettings } = await supabase.from("fine_settings").select("id").limit(1);
      
      let error = null;
      if (dbSettings && dbSettings.length > 0) {
        const { error: err } = await supabase
          .from("fine_settings")
          .update({
            late_fine_rate: lateRate,
            leave_fine_rate: leaveRate
          })
          .eq("id", dbSettings[0].id);
        error = err;
      } else {
        const { error: err } = await supabase
          .from("fine_settings")
          .insert({
            late_fine_rate: lateRate,
            leave_fine_rate: leaveRate
          });
        error = err;
      }

      localStorage.setItem("local_fine_rates", JSON.stringify({
        late_fine_rate: lateRate,
        leave_fine_rate: leaveRate
      }));

      if (!error) {
        triggerToast("Fine rate values updated successfully ✓", true);
        loadFinesAndSettings();
      } else {
        triggerToast("Rates saved locally! ✓", true);
        loadFinesAndSettings();
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to save fine rates.", false);
    } finally {
      setUpdatingRates(false);
    }
  };

  const addIntervalFine = async (studentId: string) => {
    try {
      setLoading(true);
      
      // Save fine transaction to leave_audit_logs
      const { error } = await supabase
        .from("leave_audit_logs")
        .insert({
          student_id: studentId,
          action: 'Submitted',
          performed_by: 'Admin (Dashboard)',
          details: `Manual Fine: Interval Fine added by Admin. Amount: 50`
        });

      // Local storage fallback increment
      const localKey = `local_manual_interval_fines_${studentId}`;
      const currentCount = Number(localStorage.getItem(localKey) || "0");
      localStorage.setItem(localKey, (currentCount + 1).toString());

      triggerToast("Interval late fine of ₹50 added successfully! ✓", true);
      loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to add interval fine.", false);
      setLoading(false);
    }
  };

  const addAbsentFine = async (studentId: string) => {
    try {
      setLoading(true);
      
      await supabase
        .from("leave_audit_logs")
        .insert({
          student_id: studentId,
          action: 'Submitted',
          performed_by: 'Admin (Dashboard)',
          details: `Manual Fine: Absent Fine added by Admin. Amount: 500`
        });

      // Clear any manual set override from local storage so it compiles correctly
      const localAdjKey = `local_manual_absent_fine_adj_${studentId}`;
      localStorage.removeItem(localAdjKey);

      triggerToast("Absent fine of ₹500 added successfully! ✓", true);
      loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to add absent fine.", false);
      setLoading(false);
    }
  };

  const editAbsentFine = async (studentId: string, currentAmount: number) => {
    const val = prompt(`Enter new Absent Fine amount (₹) for this student:`, currentAmount.toString());
    if (val === null) return;
    const num = parseInt(val.trim(), 10);
    if (isNaN(num) || num < 0) {
      alert("Please enter a valid non-negative number.");
      return;
    }

    try {
      setLoading(true);
      
      await supabase
        .from("leave_audit_logs")
        .insert({
          student_id: studentId,
          action: 'Submitted',
          performed_by: 'Admin (Dashboard)',
          details: `Manual Adjustment: Absent Fine set to ${num}`
        });

      const localAdjKey = `local_manual_absent_fine_adj_${studentId}`;
      localStorage.setItem(localAdjKey, num.toString());

      triggerToast(`Absent fine successfully updated to ₹${num}! ✓`, true);
      loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to edit absent fine.", false);
      setLoading(false);
    }
  };

  const removeAbsentFine = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove the Absent Fine for this student? (Sets to ₹0)")) return;

    try {
      setLoading(true);
      
      await supabase
        .from("leave_audit_logs")
        .insert({
          student_id: studentId,
          action: 'Submitted',
          performed_by: 'Admin (Dashboard)',
          details: `Manual Adjustment: Absent Fine removed. Amount: 0`
        });

      const localAdjKey = `local_manual_absent_fine_adj_${studentId}`;
      localStorage.setItem(localAdjKey, "0");

      triggerToast("Absent fine successfully removed! ✓", true);
      loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to remove absent fine.", false);
      setLoading(false);
    }
  };

  const togglePayment = async (row: FineRow) => {
    const nextStatus = row.payment_status === 'Paid' ? 'Unpaid' : 'Paid';
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    try {
      setLoading(true);

      const { data: checkRec } = await supabase
        .from("student_fines")
        .select("id")
        .eq("student_id", row.student_id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      let err = null;
      if (checkRec) {
        const { error } = await supabase
          .from("student_fines")
          .update({ payment_status: nextStatus })
          .eq("id", checkRec.id);
        err = error;
      } else {
        const { error } = await supabase
          .from("student_fines")
          .insert({
            student_id: row.student_id,
            month: currentMonth,
            year: currentYear,
            payment_status: nextStatus
          });
        err = error;
      }

      const localKey = `local_fines_${currentMonth}_${currentYear}`;
      const list = JSON.parse(localStorage.getItem(localKey) || "[]");
      const idx = list.findIndex((f: any) => f.student_id === row.student_id);
      if (idx !== -1) list.splice(idx, 1);
      
      list.push({
        student_id: row.student_id,
        payment_status: nextStatus
      });
      localStorage.setItem(localKey, JSON.stringify(list));

      if (!err) {
        triggerToast(`Updated fine payment status to ${nextStatus} ✓`, true);
      } else {
        triggerToast(`Updated locally to ${nextStatus} ✓`, true);
      }
      loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to update status.", false);
      setLoading(false);
    }
  };

  const filteredFinesList = finesList.filter((row) =>
    row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.register_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 space-y-8 animate-slide-up-fast">
      
      {/* Settings Grid Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fine Configurations */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-1">
          <h3 className="mb-5 font-display text-[0.95rem] font-bold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
            <Settings className="h-4.5 w-4.5 text-primary" /> Fine Rate Configurations
          </h3>

          <form onSubmit={handleUpdateRates} className="space-y-4">
            <div>
              <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Late Entry Fine (per late day)
              </label>
              <div className="relative">
                <span className="absolute top-2.5 left-3 text-muted-foreground text-[0.82rem] font-bold">₹</span>
                <input
                  type="number"
                  required
                  value={lateRate}
                  onChange={e => setLateRate(Number(e.target.value))}
                  className="w-full pl-7 pr-4 py-2 rounded-lg border border-border bg-surface text-[0.82rem] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Absent / Leave Fine (per day)
              </label>
              <div className="relative">
                <span className="absolute top-2.5 left-3 text-muted-foreground text-[0.82rem] font-bold">₹</span>
                <input
                  type="number"
                  required
                  value={leaveRate}
                  onChange={e => setLeaveRate(Number(e.target.value))}
                  className="w-full pl-7 pr-4 py-2 rounded-lg border border-border bg-surface text-[0.82rem] outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={updatingRates}
              className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[0.82rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
            >
              {updatingRates ? "Saving Configs..." : "Save Fine Rates"}
            </button>
          </form>
        </div>

        {/* Info card statistics */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="mb-2 font-display text-[0.95rem] font-bold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-accent" /> Fines Summary
            </h3>
            <p className="text-[0.78rem] text-muted-foreground leading-relaxed">
              Leave Fines (₹500 per absent day) are generated automatically whenever a student is marked Absent. Interval Fines (₹50) are NOT automatic and appear only when manually added by an administrator.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="font-display text-2xl font-bold text-warn">
                ₹{lateRate}
              </div>
              <div className="text-[0.62rem] uppercase tracking-wider text-muted-foreground mt-1">
                Late Entry rate (Manual Only)
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="font-display text-2xl font-bold text-warn">
                ₹{leaveRate}
              </div>
              <div className="text-[0.62rem] uppercase tracking-wider text-muted-foreground mt-1">
                Absent / Leave rate (Automatic)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Fines Records List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-lg">
        <div className="flex items-center justify-between border-b border-border/40 px-6 py-5">
          <div>
            <h3 className="font-display text-[1rem] font-bold">Student Fine Directory</h3>
            <span className="text-[0.72rem] text-muted-foreground">Month: {MONTH_NAMES[new Date().getMonth()]}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or reg no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-lg bg-surface border border-border text-[0.82rem] w-64 outline-none focus:border-primary/60"
              />
            </div>

            <button 
              onClick={loadFinesAndSettings}
              className="p-2 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground"
              title="Refresh Fines"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Recalculating fine balances...
          </div>
        ) : filteredFinesList.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            {searchTerm ? "No students match your search." : "No fines records compiled yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface text-muted-foreground text-[0.72rem] font-bold uppercase tracking-wider border-b border-border/50">
                  <th className="px-6 py-4 text-left">Student</th>
                  <th className="px-6 py-4 text-left">Late Days (Fine)</th>
                  <th className="px-6 py-4 text-left">Absent Days (Fine)</th>
                  <th className="px-6 py-4 text-left">Total Fine</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFinesList.map(row => (
                  <tr key={row.register_number} className="border-b border-border/40 hover:bg-surface/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[0.88rem]">{row.name}</div>
                      <div className="text-[0.7rem] text-muted-foreground">Reg: {row.register_number}</div>
                    </td>

                    <td className="px-6 py-4 text-[0.82rem]">
                      <div>{row.late_days} Late(s)</div>
                      <div className="text-[0.7rem] text-muted-foreground">Fine: ₹{row.late_fine}</div>
                    </td>

                    <td className="px-6 py-4 text-[0.82rem] space-y-1">
                      <div className="font-semibold text-foreground">{row.absent_days} Absent(s)</div>
                      <div className="text-[0.7rem] text-muted-foreground font-bold">Fine: ₹{row.absent_fine}</div>
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        <button
                          onClick={() => addAbsentFine(row.student_id)}
                          className="rounded bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-1.5 py-0.5 text-[0.62rem] font-bold transition-all"
                          title="Add manual ₹500 Absent Fine"
                        >
                          +₹500
                        </button>
                        <button
                          onClick={() => editAbsentFine(row.student_id, row.absent_fine)}
                          className="rounded bg-[#2e3b4e] border border-border text-foreground hover:bg-[#3d4f68] px-1.5 py-0.5 text-[0.62rem] font-bold transition-all"
                          title="Edit Absent Fine amount"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeAbsentFine(row.student_id)}
                          className="rounded bg-warn/10 border border-warn/20 text-warn hover:bg-warn/20 px-1.5 py-0.5 text-[0.62rem] font-bold transition-all"
                          title="Remove Absent Fine"
                        >
                          Remove
                        </button>
                      </div>
                    </td>

                    <td className="px-6 py-4 font-display font-bold text-[0.9rem] text-warn">
                      ₹{row.total_fine}
                    </td>

                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${
                        row.total_fine === 0 
                          ? "bg-present/10 text-present border border-present/10"
                          : row.payment_status === 'Paid'
                          ? "bg-present/15 text-present border border-present/20"
                          : "bg-absent/15 text-absent border border-absent/20 animate-pulse"
                      }`}>
                        {row.total_fine === 0 ? "No Fine" : row.payment_status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => addIntervalFine(row.student_id)}
                        className="rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-[0.75rem] font-bold transition-all flex items-center gap-1"
                        title="Add manual ₹50 late entry fine"
                      >
                        <Plus className="h-3.5 w-3.5" /> +₹50 Late Fine
                      </button>
                      <button
                        onClick={() => togglePayment(row)}
                        disabled={row.total_fine === 0}
                        className={`rounded-lg border px-3 py-1.5 text-[0.75rem] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          row.payment_status === 'Paid'
                            ? "border-warn/30 bg-warn/10 text-warn hover:bg-warn/20"
                            : "border-present/30 bg-present/10 text-present hover:bg-present/20"
                        }`}
                      >
                        {row.payment_status === 'Paid' ? "Mark Unpaid" : "Mark Paid"}
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 ${toast.success ? "border-present text-present" : "border-warn text-warn"}`}>
          {toast.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

    </div>
  );
};

export default AdminFines;