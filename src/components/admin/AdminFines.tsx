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
  Award
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

const AdminFines = () => {
  const [finesList, setFinesList] = useState<FineRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings rates
  const [lateRate, setLateRate] = useState(50);
  const [leaveRate, setLeaveRate] = useState(100);
  const [updatingRates, setUpdatingRates] = useState(false);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFinesAndSettings = async () => {
    try {
      setLoading(true);
      // 1. Fetch Fine Settings
      const { data: dbSettings, error: errSettings } = await supabase
        .from("fine_settings")
        .select("late_fine_rate, leave_fine_rate")
        .limit(1);

      let lRate = 50;
      let lvRate = 100;

      if (!errSettings && dbSettings && dbSettings.length > 0) {
        lRate = Number(dbSettings[0].late_fine_rate);
        lvRate = Number(dbSettings[0].leave_fine_rate);
        setLateRate(lRate);
        setLeaveRate(lvRate);
      } else {
        const storedRates = localStorage.getItem("local_fine_rates");
        if (storedRates) {
          const rates = JSON.parse(storedRates);
          lRate = rates.late_fine_rate;
          lvRate = rates.leave_fine_rate;
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

      // 3. Fetch Attendance History to count late & absent days
      const { data: dbAtt } = await supabase
        .from("attendance")
        .select("student_id, status, is_late");

      let attendanceList: any[] = [];
      if (dbAtt) {
        attendanceList = dbAtt;
      } else {
        attendanceList = JSON.parse(localStorage.getItem("local_att_history") || "[]");
      }

      // 4. Fetch Student Fines Payment Statuses
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      
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

      // 5. Calculate fine per student
      const calculatedList: FineRow[] = activeStudents.map(student => {
        const records = attendanceList.filter(a => a.student_id === student.id);
        
        // Count late arrivals
        const lateDays = records.filter(r => r.is_late === true).length;
        
        // Count absent days
        const absentDays = records.filter(r => r.status.toLowerCase() === 'absent').length;

        // Fines calculation
        const lFine = lateDays * lRate;
        const abFine = absentDays * lvRate;
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
      // 1. Try Supabase Update
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

      // Sync LocalStorage
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

  const togglePayment = async (row: FineRow) => {
    const nextStatus = row.payment_status === 'Paid' ? 'Unpaid' : 'Paid';
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    try {
      setLoading(true);

      // Check if fine record exists in Supabase
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

      // Local storage backup
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
              Fines are automatically compiled at the end of the month based on total absent days and checked late entries. Administrators can toggle payment states when student collections are complete.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="font-display text-2xl font-bold text-warn">
                ₹{lateRate}
              </div>
              <div className="text-[0.62rem] uppercase tracking-wider text-muted-foreground mt-1">
                Late Entry rate
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4 text-center">
              <div className="font-display text-2xl font-bold text-warn">
                ₹{leaveRate}
              </div>
              <div className="text-[0.62rem] uppercase tracking-wider text-muted-foreground mt-1">
                Absent / Leave rate
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
          <button 
            onClick={loadFinesAndSettings}
            className="p-2 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground"
            title="Refresh Fines"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Recalculating fine balances...
          </div>
        ) : finesList.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No fines records compiled yet.
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
                {finesList.map(row => (
                  <tr key={row.register_number} className="border-b border-border/40 hover:bg-surface/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-bold text-[0.88rem]">{row.name}</div>
                      <div className="text-[0.7rem] text-muted-foreground">Reg: {row.register_number}</div>
                    </td>

                    <td className="px-6 py-4 text-[0.82rem]">
                      <div>{row.late_days} Late(s)</div>
                      <div className="text-[0.7rem] text-muted-foreground">Fine: ₹{row.late_fine}</div>
                    </td>

                    <td className="px-6 py-4 text-[0.82rem]">
                      <div>{row.absent_days} Absent(s)</div>
                      <div className="text-[0.7rem] text-muted-foreground">Fine: ₹{row.absent_fine}</div>
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

                    <td className="px-6 py-4 text-center">
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
