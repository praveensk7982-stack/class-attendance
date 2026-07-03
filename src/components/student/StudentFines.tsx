import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  CreditCard, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Award,
  Sparkles
} from "lucide-react";

interface StudentFinesProps {
  student: any;
}

const StudentFines = ({ student }: StudentFinesProps) => {
  const [loading, setLoading] = useState(true);
  const [fines, setFines] = useState({
    lateDays: 0,
    lateFine: 0,
    absentDays: 0,
    absentFine: 0,
    totalFine: 0,
    paymentStatus: 'Unpaid'
  });
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState(student.name);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFinesDetails = async () => {
    try {
      setLoading(true);
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // 1. Fetch Fine Settings
      const { data: dbSettings } = await supabase
        .from("fine_settings")
        .select("late_fine_rate, leave_fine_rate")
        .limit(1);

      let lRate = 50;
      let lvRate = 100;

      if (dbSettings && dbSettings.length > 0) {
        lRate = Number(dbSettings[0].late_fine_rate);
        lvRate = Number(dbSettings[0].leave_fine_rate);
      } else {
        const storedRates = localStorage.getItem("local_fine_rates");
        if (storedRates) {
          const rates = JSON.parse(storedRates);
          lRate = rates.late_fine_rate;
          lvRate = rates.leave_fine_rate;
        }
      }

      // 2. Fetch Student Attendance records to calculate days
      const { data: dbAtt, error } = await supabase
        .from("attendance")
        .select("status, is_late")
        .eq("student_id", student.id);

      let records: any[] = [];
      if (!error && dbAtt) {
        records = dbAtt;
      } else {
        const history = JSON.parse(localStorage.getItem("local_att_history") || "[]");
        records = history.filter((h: any) => h.student_id === student.id.toString());
      }

      const lateDays = records.filter(r => r.is_late === true).length;
      const absentDays = records.filter(r => r.status.toLowerCase() === 'absent').length;

      const lateFine = lateDays * lRate;
      const absentFine = absentDays * lvRate;
      const totalFine = lateFine + absentFine;

      // 3. Fetch Payment Status
      const { data: dbFines } = await supabase
        .from("student_fines")
        .select("payment_status")
        .eq("student_id", student.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      let paymentStatus = 'Unpaid';
      if (dbFines) {
        paymentStatus = dbFines.payment_status;
      } else {
        const localKey = `local_fines_${currentMonth}_${currentYear}`;
        const list = JSON.parse(localStorage.getItem(localKey) || "[]");
        const match = list.find((f: any) => f.student_id === student.id.toString());
        if (match) paymentStatus = match.payment_status;
      }

      setFines({
        lateDays,
        lateFine,
        absentDays,
        absentFine,
        totalFine,
        paymentStatus
      });

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinesDetails();
  }, [student.id]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvv) return;

    setPaying(true);

    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 1. Try Supabase update status
      const { data: checkRec } = await supabase
        .from("student_fines")
        .select("id")
        .eq("student_id", student.id)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      let err = null;
      if (checkRec) {
        const { error } = await supabase
          .from("student_fines")
          .update({ payment_status: 'Paid' })
          .eq("id", checkRec.id);
        err = error;
      } else {
        const { error } = await supabase
          .from("student_fines")
          .insert({
            student_id: student.id,
            month: currentMonth,
            year: currentYear,
            payment_status: 'Paid'
          });
        err = error;
      }

      // Local storage update fallback
      const localKey = `local_fines_${currentMonth}_${currentYear}`;
      const list = JSON.parse(localStorage.getItem(localKey) || "[]");
      const idx = list.findIndex((f: any) => f.student_id === student.id.toString());
      if (idx !== -1) list.splice(idx, 1);
      
      list.push({
        student_id: student.id.toString(),
        payment_status: 'Paid'
      });
      localStorage.setItem(localKey, JSON.stringify(list));

      setPaymentSuccess(true);
      setTimeout(() => {
        setPaymentSuccess(false);
        setShowPaymentModal(false);
        loadFinesDetails();
        triggerToast("Fine payment processed successfully! ✓", true);
      }, 2500);

    } catch (err) {
      console.error(err);
      triggerToast("Payment failed. Please retry.", false);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-slide-up-fast">
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Recalculating fine balances...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Detailed Calculations Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-2 space-y-5">
            <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4">Monthly Fine Statement</h3>

            <div className="space-y-4">
              {/* Late arrivals line */}
              <div className="flex justify-between items-center text-[0.88rem] border-b border-border/20 pb-2">
                <div>
                  <div className="font-bold text-foreground">Late Arrivals</div>
                  <div className="text-[0.72rem] text-muted-foreground">{fines.lateDays} occurrences</div>
                </div>
                <div className="font-mono font-bold text-foreground">₹{fines.lateFine}</div>
              </div>

              {/* Absences line */}
              <div className="flex justify-between items-center text-[0.88rem] border-b border-border/20 pb-2">
                <div>
                  <div className="font-bold text-foreground">Unexcused Absences / Leaves</div>
                  <div className="text-[0.72rem] text-muted-foreground">{fines.absentDays} occurrences</div>
                </div>
                <div className="font-mono font-bold text-foreground">₹{fines.absentFine}</div>
              </div>

              {/* Total Balance */}
              <div className="flex justify-between items-center text-[1rem] pt-2 font-display font-bold">
                <span className="text-foreground">Total Pending Fines</span>
                <span className="text-warn text-xl">₹{fines.totalFine}</span>
              </div>
            </div>

            {/* Note alert */}
            <div className="text-[0.72rem] text-muted-foreground leading-relaxed bg-surface/50 border border-border/30 rounded-xl p-4 flex gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
              <div>
                Fine details are generated instantly based on checks. If you have been falsely marked absent or late, report it to the administrator for revision.
              </div>
            </div>
          </div>

          {/* Payment Status Action Card */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4 mb-4">Payment Summary</h3>
              
              <div className="space-y-4 py-2">
                <div>
                  <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">Status</span>
                  <div className="mt-1">
                    <span className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                      fines.totalFine === 0 
                        ? "bg-present/10 text-present border border-present/10"
                        : fines.paymentStatus === 'Paid'
                        ? "bg-present/15 text-present border border-present/20"
                        : "bg-absent/15 text-absent border border-absent/20"
                    }`}>
                      {fines.totalFine === 0 ? "No Fines" : fines.paymentStatus}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">Billing Period</span>
                  <p className="text-[0.88rem] font-semibold text-foreground mt-0.5">
                    {MONTH_NAMES[new Date().getMonth()]} {new Date().getFullYear()}
                  </p>
                </div>
              </div>
            </div>

            {fines.totalFine > 0 && fines.paymentStatus === 'Unpaid' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="btn-gradient mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
              >
                <CreditCard className="h-4.5 w-4.5" /> Pay Fine Online
              </button>
            )}

            {fines.totalFine === 0 && (
              <div className="mt-6 rounded-xl bg-present/10 border border-present/20 text-present text-center text-[0.8rem] font-medium py-3">
                ✓ Account cleared of fine balances
              </div>
            )}

            {fines.totalFine > 0 && fines.paymentStatus === 'Paid' && (
              <div className="mt-6 rounded-xl bg-present/15 border border-present/20 text-present text-center text-[0.8rem] font-medium py-3">
                ✓ Invoice paid for this cycle
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Process Modal Mockup */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && !paying && setShowPaymentModal(false)}>
          <div className="w-full max-w-[420px] rounded-[24px] border border-border bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up-fast">
            
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-br from-primary/10 to-accent/5 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold">Secure Payment Portal</h3>
                <p className="text-[0.72rem] text-muted-foreground">Amount: <strong className="text-warn">₹{fines.totalFine}</strong></p>
              </div>
              {!paying && (
                <button onClick={() => setShowPaymentModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-warn">✕</button>
              )}
            </div>

            {paymentSuccess ? (
              <div className="p-8 text-center space-y-3 flex flex-col items-center">
                <div className="h-16 w-16 bg-present/10 border border-present/30 rounded-full flex items-center justify-center text-present animate-bounce">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <h4 className="font-display text-lg font-bold text-present">Payment Successful!</h4>
                <p className="text-[0.8rem] text-muted-foreground">Your transaction has been settled. Fine status updating...</p>
              </div>
            ) : (
              <form onSubmit={handlePayment} className="p-6 space-y-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Cardholder Name</label>
                  <input type="text" required value={cardName} onChange={e => setCardName(e.target.value)} disabled={paying} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>

                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Credit Card Number</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={19}
                    placeholder="4111 2222 3333 4444"
                    value={cardNumber} 
                    onChange={e => setCardNumber(e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim())} 
                    disabled={paying} 
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none font-mono" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Expiry (MM/YY)</label>
                    <input type="text" required maxLength={5} placeholder="12/28" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} disabled={paying} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none font-mono" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">CVV</label>
                    <input type="password" required maxLength={3} placeholder="•••" value={cardCvv} onChange={e => setCardCvv(e.target.value)} disabled={paying} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none font-mono" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={paying}
                  className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.85rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md mt-6 disabled:opacity-50"
                >
                  {paying ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" /> Processing Transaction...
                    </>
                  ) : (
                    `Complete Payment — ₹${fines.totalFine}`
                  )}
                </button>
              </form>
            )}

          </div>
        </div>
      )}

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

export default StudentFines;
