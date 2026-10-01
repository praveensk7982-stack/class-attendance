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
  payment_status: 'Paid' | 'Unpaid' | 'Pending';
  pending_count: number;
  entry_count: number;
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

      // 3. Fetch every fine row (one row per fine)
      const { data: entries, error: entErr } = await supabase
        .from("fine_entries")
        .select("student_id, type, amount, status");
      if (entErr) throw entErr;

      const unpaidSum = (list: any[]) =>
        list.filter(e => e.status === 'Unpaid').reduce((acc, e) => acc + Number(e.amount), 0);

      // 4. Calculate per student
      const calculatedList: FineRow[] = activeStudents.map(student => {
        const mine = (entries ?? []).filter((e: any) => e.student_id === student.id);
        const late = mine.filter((e: any) => e.type === 'Late');
        const absent = mine.filter((e: any) => e.type === 'Absent');
        const lFine = unpaidSum(late);
        const abFine = unpaidSum(absent);
        const pendingRows = mine.filter((e: any) => e.status === 'Pending');
        const pendingAmt = pendingRows.reduce((acc: number, e: any) => acc + Number(e.amount), 0);
        const total = lFine + abFine + pendingAmt;

        return {
          student_id: student.id,
          name: student.name,
          register_number: student.register_number,
          class: student.class,
          late_days: late.length,
          absent_days: absent.length,
          late_fine: lFine,
          absent_fine: abFine,
          total_fine: total,
          payment_status: (pendingRows.length > 0 ? 'Pending' : total === 0 && mine.length > 0 ? 'Paid' : 'Unpaid') as 'Paid' | 'Unpaid' | 'Pending',
          pending_count: pendingRows.length,
          entry_count: mine.length
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

    const channel = supabase
      .channel('admin-fines-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fine_entries' }, () => {
        loadFinesAndSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpdateRates = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(lateRate >= 0) || !(leaveRate >= 0)) {
      triggerToast("Please enter valid fine rates.", false);
      return;
    }
    if (!confirm(
      `Save new rates?\n\nAll UNPAID fines will be updated:\n• Late fine → ₹${lateRate}\n• Absent fine → ₹${leaveRate}\n\nFines already PAID will not change.`
    )) return;

    setUpdatingRates(true);

    try {
      const { data: dbSettings, error: selErr } = await supabase
        .from("fine_settings")
        .select("id")
        .limit(1);
      if (selErr) throw selErr;

      if (dbSettings && dbSettings.length > 0) {
        const { error } = await supabase
          .from("fine_settings")
          .update({ late_fine_rate: lateRate, leave_fine_rate: leaveRate })
          .eq("id", dbSettings[0].id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("fine_settings")
          .insert({ late_fine_rate: lateRate, leave_fine_rate: leaveRate });
        if (error) throw error;
      }

      // Outstanding (unpaid) fines follow the new rates. Paid fines keep their old amount.
      const { error: lateErr } = await supabase
        .from("fine_entries")
        .update({ amount: lateRate })
        .eq("type", "Late")
        .eq("status", "Unpaid");
      if (lateErr) throw lateErr;

      const { error: absentErr } = await supabase
        .from("fine_entries")
        .update({ amount: leaveRate })
        .eq("type", "Absent")
        .eq("status", "Unpaid");
      if (absentErr) throw absentErr;

      localStorage.setItem("local_fine_rates", JSON.stringify({
        late_fine_rate: lateRate,
        leave_fine_rate: leaveRate
      }));

      triggerToast("Fine rates saved. Unpaid fines updated ✓", true);
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to save fine rates.", false);
    } finally {
      setUpdatingRates(false);
    }
  };

  const addFine = async (studentId: string, type: 'Late' | 'Absent') => {
    try {
      setLoading(true);
      const amount = type === 'Late' ? lateRate : leaveRate;
      const { error } = await supabase.from("fine_entries").insert({
        student_id: studentId,
        type,
        amount,
        created_by: 'Admin (Dashboard)'
      });
      if (error) throw error;
      triggerToast(`${type === 'Late' ? 'Interval late' : 'Absent'} fine of ₹${amount} added successfully! ✓`, true);
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to add fine.", false);
      setLoading(false);
    }
  };

  const addIntervalFine = (studentId: string) => addFine(studentId, 'Late');
  const addAbsentFine = (studentId: string) => addFine(studentId, 'Absent');

  const removeAbsentFine = async (studentId: string) => {
    if (!confirm("Remove all UNPAID Absent Fines for this student?")) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("fine_entries")
        .delete()
        .eq("student_id", studentId)
        .eq("type", "Absent")
        .eq("status", "Unpaid");
      if (error) throw error;
      triggerToast("Unpaid absent fines removed! ✓", true);
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to remove absent fine.", false);
      setLoading(false);
    }
  };

  const togglePayment = async (row: FineRow) => {
    try {
      setLoading(true);
      if (row.payment_status === 'Unpaid') {
        const { error } = await supabase
          .from("fine_entries")
          .update({ status: 'Paid', paid_at: new Date().toISOString() })
          .eq("student_id", row.student_id)
          .eq("status", "Unpaid");
        if (error) throw error;
        triggerToast("Marked as Paid ✓", true);
      } else {
        // Undo only the most recent payment batch
        const { data: last, error: lastErr } = await supabase
          .from("fine_entries")
          .select("paid_at")
          .eq("student_id", row.student_id)
          .eq("status", "Paid")
          .order("paid_at", { ascending: false })
          .limit(1);
        if (lastErr) throw lastErr;
        if (last && last[0]?.paid_at) {
          const { error } = await supabase
            .from("fine_entries")
            .update({ status: 'Unpaid', paid_at: null })
            .eq("student_id", row.student_id)
            .eq("paid_at", last[0].paid_at);
          if (error) throw error;
        }
        triggerToast("Last payment reverted ✓", true);
      }
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to update status.", false);
      setLoading(false);
    }
  };

  // Admin confirms a student's submitted payment (Pending -> Paid)
  const confirmPayment = async (row: FineRow) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("fine_entries")
        .update({ status: 'Paid' })
        .eq("student_id", row.student_id)
        .eq("status", "Pending");
      if (error) throw error;
      triggerToast("Payment confirmed ✓", true);
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to confirm payment.", false);
      setLoading(false);
    }
  };

  // Admin rejects a submitted payment (Pending -> Unpaid)
  const rejectPayment = async (row: FineRow) => {
    if (!confirm("Reject this payment? The fines go back to Unpaid.")) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from("fine_entries")
        .update({ status: 'Unpaid', paid_at: null, pay_approver: null, receipt_id: null })
        .eq("student_id", row.student_id)
        .eq("status", "Pending");
      if (error) throw error;
      triggerToast("Payment rejected. Fines are Unpaid again.", true);
      await loadFinesAndSettings();
    } catch (err) {
      console.error(err);
      triggerToast("Failed to reject payment.", false);
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
              Leave Fines (₹{leaveRate} per absent day) are generated automatically whenever a student is marked Absent. Interval Fines (₹{lateRate}) are NOT automatic and appear only when manually added by an administrator.
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
            <span className="text-[0.72rem] text-muted-foreground">Outstanding balance (all months)</span>
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
                          title={`Add manual ₹${leaveRate} Absent Fine`}
                        >
                          +₹{leaveRate}
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
                          : row.payment_status === 'Pending'
                          ? "bg-warn/15 text-warn border border-warn/20"
                          : row.payment_status === 'Paid'
                          ? "bg-present/15 text-present border border-present/20"
                          : "bg-absent/15 text-absent border border-absent/20 animate-pulse"
                      }`}>
                        {row.total_fine === 0 ? (row.entry_count > 0 ? "Paid" : "No Fine") : row.payment_status}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => addIntervalFine(row.student_id)}
                        className="rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-[0.75rem] font-bold transition-all flex items-center gap-1"
                        title={`Add manual ₹${lateRate} late entry fine`}
                      >
                        <Plus className="h-3.5 w-3.5" /> +₹{lateRate} Late Fine
                      </button>
                      {row.payment_status === 'Pending' ? (
                        <>
                          <button
                            onClick={() => confirmPayment(row)}
                            className="rounded-lg border border-present/30 bg-present/10 text-present hover:bg-present/20 px-3 py-1.5 text-[0.75rem] font-bold transition-all"
                          >
                            Confirm Payment
                          </button>
                          <button
                            onClick={() => rejectPayment(row)}
                            className="rounded-lg border border-absent/30 bg-absent/10 text-absent hover:bg-absent/20 px-3 py-1.5 text-[0.75rem] font-bold transition-all"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                      <button
                        onClick={() => togglePayment(row)}
                        disabled={row.entry_count === 0}
                        className={`rounded-lg border px-3 py-1.5 text-[0.75rem] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                          row.payment_status === 'Paid'
                            ? "border-warn/30 bg-warn/10 text-warn hover:bg-warn/20"
                            : "border-present/30 bg-present/10 text-present hover:bg-present/20"
                        }`}
                      >
                        {row.payment_status === 'Paid' ? "Mark Unpaid" : "Mark Paid"}
                      </button>
                      )}
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