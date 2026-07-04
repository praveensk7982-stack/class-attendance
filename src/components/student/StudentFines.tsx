import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MONTH_NAMES } from "@/data/students";
import { 
  DollarSign, 
  CreditCard, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Award,
  Sparkles,
  Calendar,
  Clock,
  Download,
  FileText
} from "lucide-react";

interface StudentFinesProps {
  student: any;
}

interface ReceiptDetails {
  receiptId: string;
  studentName: string;
  registerNumber: string;
  fineType: string;
  amount: number;
  approvedBy: 'Class Advisor' | 'HOD';
  paymentDate: string;
  status: string;
}

const StudentFines = ({ student }: StudentFinesProps) => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'leave' | 'interval'>('leave');
  
  const [fines, setFines] = useState({
    lateDays: 0,
    lateFine: 0,
    absentDays: 0,
    absentFine: 0,
    totalFine: 0,
    paymentStatus: 'Unpaid'
  });

  // Track partial payments locally
  const [leavePaid, setLeavePaid] = useState(false);
  const [intervalPaid, setIntervalPaid] = useState(false);
  
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);

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

      // Synchronize tab specific payment markers
      if (paymentStatus === 'Paid') {
        setLeavePaid(true);
        setIntervalPaid(true);
      } else {
        const lp = localStorage.getItem(`partial_leave_paid_${student.id}_${currentMonth}_${currentYear}`) === 'true';
        const ip = localStorage.getItem(`partial_interval_paid_${student.id}_${currentMonth}_${currentYear}`) === 'true';
        setLeavePaid(lp);
        setIntervalPaid(ip);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinesDetails();
  }, [student.id]);

  const handlePayment = async (approver: 'Class Advisor' | 'HOD') => {
    setPaying(true);

    try {
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Simulate payment network delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const isPayingLeave = activeTab === 'leave';
      let nextLeavePaid = leavePaid;
      let nextIntervalPaid = intervalPaid;

      if (isPayingLeave) {
        nextLeavePaid = true;
        setLeavePaid(true);
        localStorage.setItem(`partial_leave_paid_${student.id}_${currentMonth}_${currentYear}`, 'true');
      } else {
        nextIntervalPaid = true;
        setIntervalPaid(true);
        localStorage.setItem(`partial_interval_paid_${student.id}_${currentMonth}_${currentYear}`, 'true');
      }

      // Check if both are paid (or have 0 fine)
      const leaveFineCleared = nextLeavePaid || fines.absentFine === 0;
      const intervalFineCleared = nextIntervalPaid || fines.lateFine === 0;

      if (leaveFineCleared && intervalFineCleared) {
        // Update database fine record to Paid
        const { data: checkRec } = await supabase
          .from("student_fines")
          .select("id")
          .eq("student_id", student.id)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .maybeSingle();

        if (checkRec) {
          await supabase
            .from("student_fines")
            .update({ payment_status: 'Paid' })
            .eq("id", checkRec.id);
        } else {
          await supabase
            .from("student_fines")
            .insert({
              student_id: student.id,
              month: currentMonth,
              year: currentYear,
              payment_status: 'Paid'
            });
        }

        // Local storage overall update fallback
        const localKey = `local_fines_${currentMonth}_${currentYear}`;
        const list = JSON.parse(localStorage.getItem(localKey) || "[]");
        const idx = list.findIndex((f: any) => f.student_id === student.id.toString());
        if (idx !== -1) list.splice(idx, 1);
        
        list.push({
          student_id: student.id.toString(),
          payment_status: 'Paid'
        });
        localStorage.setItem(localKey, JSON.stringify(list));
      }

      // Generate receipt
      const recId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      const rec: ReceiptDetails = {
        receiptId: recId,
        studentName: student.name,
        registerNumber: student.register_number,
        fineType: isPayingLeave ? "Leave Fine" : "Interval Fine",
        amount: isPayingLeave ? fines.absentFine : fines.lateFine,
        approvedBy: approver,
        paymentDate: new Date().toLocaleString(),
        status: 'Paid'
      };

      setReceipt(rec);

      // Log action in audit logs
      try {
        await supabase.from("leave_audit_logs").insert({
          student_id: student.id,
          action: 'Approved',
          performed_by: 'Admin',
          details: `Fine payment of ₹${rec.amount} approved by ${approver}. Receipt ID: ${recId}`
        });
      } catch (logErr) {
        console.error(logErr);
      }

      // Set state and show receipt
      setShowApprovalModal(false);
      setShowReceiptModal(true);

      // Update UI fine amounts
      setFines(prev => ({
        ...prev,
        absentFine: isPayingLeave ? 0 : prev.absentFine,
        lateFine: !isPayingLeave ? 0 : prev.lateFine,
        totalFine: isPayingLeave ? prev.lateFine : prev.absentFine
      }));

      triggerToast(`${isPayingLeave ? "Leave" : "Interval"} fine paid successfully! ✓`, true);

    } catch (err) {
      console.error(err);
      triggerToast("Payment failed. Please retry.", false);
    } finally {
      setPaying(false);
    }
  };

  const downloadReceipt = (rec: ReceiptDetails | null) => {
    if (!rec) return;
    const content = `=========================================
          PAYMENT RECEIPT
=========================================
Receipt ID:     ${rec.receiptId}
Status:         ${rec.status.toUpperCase()}
Date/Time:      ${rec.paymentDate}
-----------------------------------------
Student Name:   ${rec.studentName}
Register No:    ${rec.registerNumber}
-----------------------------------------
Fine Category:  ${rec.fineType}
Fine Amount:    ₹${rec.amount}.00
Approved By:    ${rec.approvedBy}
=========================================
         THANK YOU FOR PAYING
=========================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Receipt_${rec.receiptId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("Receipt file downloaded successfully! ✓", true);
  };

  const getActiveTabFineAmount = () => {
    return activeTab === 'leave' ? fines.absentFine : fines.lateFine;
  };

  return (
    <div className="p-6 md:p-8 space-y-6 animate-slide-up-fast">
      
      {/* Premium Tabs Header */}
      <div className="flex border-b border-border/40 gap-6">
        <button
          onClick={() => setActiveTab('leave')}
          className={`flex items-center gap-2 pb-3.5 text-[0.88rem] font-bold border-b-2 transition-all relative ${
            activeTab === 'leave'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Calendar className="h-4.5 w-4.5" />
          <span>Leave Fine</span>
          {fines.absentFine > 0 && !leavePaid && (
            <span className="h-2 w-2 rounded-full bg-warn absolute -top-0.5 -right-2 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('interval')}
          className={`flex items-center gap-2 pb-3.5 text-[0.88rem] font-bold border-b-2 transition-all relative ${
            activeTab === 'interval'
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-4.5 w-4.5" />
          <span>Interval Fine</span>
          {fines.lateFine > 0 && !intervalPaid && (
            <span className="h-2 w-2 rounded-full bg-warn absolute -top-0.5 -right-2 animate-pulse" />
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Recalculating balances...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* TAB 1 CONTENT: LEAVE FINE */}
          {activeTab === 'leave' && (
            <>
              {/* Calculations Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-2 space-y-5">
                <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4">Monthly Leave Fine Statement</h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[0.88rem] border-b border-border/20 pb-2">
                    <div>
                      <div className="font-bold text-foreground">Unexcused Absences / Leaves</div>
                      <div className="text-[0.72rem] text-muted-foreground">{fines.absentDays} occurrences</div>
                    </div>
                    <div className="font-mono font-bold text-foreground">₹{fines.absentFine}</div>
                  </div>

                  <div className="flex justify-between items-center text-[1rem] pt-2 font-display font-bold">
                    <span className="text-foreground">Total Pending Leave Fines</span>
                    <span className="text-warn text-xl">₹{fines.absentFine}</span>
                  </div>
                </div>

                <div className="text-[0.72rem] text-muted-foreground leading-relaxed bg-surface/50 border border-border/30 rounded-xl p-4 flex gap-2">
                  <HelpCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    Leave Fine is calculated based on days you were marked Absent. Tapping the pay button clears this balance.
                  </div>
                </div>
              </div>

              {/* Leave Payment Status Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4 mb-4">Leave Summary</h3>
                  
                  <div className="space-y-4 py-2">
                    <div>
                      <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">Status</span>
                      <div className="mt-1">
                        <span className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                          fines.absentFine === 0 
                            ? "bg-present/10 text-present border border-present/10"
                            : leavePaid
                            ? "bg-present/15 text-present border border-present/20"
                            : "bg-absent/15 text-absent border border-absent/20"
                        }`}>
                          {fines.absentFine === 0 ? "No Fines" : leavePaid ? "Paid" : "Unpaid"}
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

                {fines.absentFine > 0 && !leavePaid && (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-gradient mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md animate-pulse"
                  >
                    <CreditCard className="h-4.5 w-4.5" /> Pay Fine
                  </button>
                )}
              </div>
            </>
          )}

          {/* TAB 2 CONTENT: INTERVAL FINE */}
          {activeTab === 'interval' && (
            <>
              {/* Calculations Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-2 space-y-5">
                <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4">Monthly Interval Late Fine Statement</h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-[0.88rem] border-b border-border/20 pb-2">
                    <div>
                      <div className="font-bold text-foreground">Late Arrivals</div>
                      <div className="text-[0.72rem] text-muted-foreground">{fines.lateDays} occurrences</div>
                    </div>
                    <div className="font-mono font-bold text-foreground">₹{fines.lateFine}</div>
                  </div>

                  <div className="flex justify-between items-center text-[1rem] pt-2 font-display font-bold">
                    <span className="text-foreground">Total Pending Interval Fines</span>
                    <span className="text-warn text-xl">₹{fines.lateFine}</span>
                  </div>
                </div>

                <div className="text-[0.72rem] text-muted-foreground leading-relaxed bg-surface/50 border border-border/30 rounded-xl p-4 flex gap-2">
                  <HelpCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    Interval Fine is calculated based on days you were checked in Late. Tapping the pay button clears this balance.
                  </div>
                </div>
              </div>

              {/* Interval Payment Status Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-[1.05rem] font-bold border-b border-border/40 pb-4 mb-4">Interval Summary</h3>
                  
                  <div className="space-y-4 py-2">
                    <div>
                      <span className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">Status</span>
                      <div className="mt-1">
                        <span className={`rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${
                          fines.lateFine === 0 
                            ? "bg-present/10 text-present border border-present/10"
                            : intervalPaid
                            ? "bg-present/15 text-present border border-present/20"
                            : "bg-absent/15 text-absent border border-absent/20"
                        }`}>
                          {fines.lateFine === 0 ? "No Fines" : intervalPaid ? "Paid" : "Unpaid"}
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

                {fines.lateFine > 0 && !intervalPaid && (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-gradient mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md animate-pulse"
                  >
                    <CreditCard className="h-4.5 w-4.5" /> Pay Fine
                  </button>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* Modern Approval Selection Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && !paying && setShowApprovalModal(false)}>
          <div className="w-full max-w-[420px] rounded-[24px] border border-border bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up-fast p-6 space-y-6">
            
            <div className="text-center space-y-2">
              <div className="h-12 w-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary mx-auto">
                <HelpCircle className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">Payment Authorization</h3>
              <p className="text-[0.78rem] text-muted-foreground px-4">
                Who approved this fine payment? Please select the corresponding authority.
              </p>
            </div>

            {paying ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-3 text-muted-foreground text-[0.82rem]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span>Processing transaction...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => handlePayment('Class Advisor')}
                  className="w-full flex items-center justify-between border border-border/60 hover:border-primary/80 bg-surface/50 hover:bg-primary/5 rounded-xl px-4 py-3.5 text-[0.85rem] font-bold text-foreground transition-all group"
                >
                  <span>Class Advisor</span>
                  <span className="text-[0.7rem] text-muted-foreground group-hover:text-primary transition-colors font-semibold">Select ➔</span>
                </button>
                
                <button
                  onClick={() => handlePayment('HOD')}
                  className="w-full flex items-center justify-between border border-border/60 hover:border-primary/80 bg-surface/50 hover:bg-primary/5 rounded-xl px-4 py-3.5 text-[0.85rem] font-bold text-foreground transition-all group"
                >
                  <span>HOD (Head of Department)</span>
                  <span className="text-[0.7rem] text-muted-foreground group-hover:text-primary transition-colors font-semibold">Select ➔</span>
                </button>
              </div>
            )}

            {!paying && (
              <button
                onClick={() => setShowApprovalModal(false)}
                className="w-full border border-border bg-transparent hover:bg-surface text-muted-foreground text-[0.82rem] font-semibold py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}

          </div>
        </div>
      )}

      {/* Professional Payment Receipt Modal */}
      {showReceiptModal && receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && setShowReceiptModal(false)}>
          <div className="w-full max-w-[440px] rounded-[24px] border border-border bg-card shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-slide-up-fast flex flex-col p-6 space-y-6">
            
            {/* Header Success Section */}
            <div className="text-center space-y-2 pb-4 border-b border-border/40">
              <div className="h-12 w-12 bg-present/10 border border-present/20 rounded-full flex items-center justify-center text-present mx-auto">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="font-display text-lg font-bold text-foreground">Payment Receipt</h3>
              <p className="text-[0.72rem] text-present font-mono font-bold tracking-wider">TRANSACTION SUCCESSFUL</p>
            </div>

            {/* Receipt Table Card */}
            <div className="rounded-xl border border-border/50 bg-surface/40 p-4 space-y-3.5 text-[0.82rem] font-mono leading-relaxed">
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Receipt ID:</span>
                <span className="font-bold text-foreground">{receipt.receiptId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Student Name:</span>
                <span className="font-bold text-foreground">{receipt.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Register No:</span>
                <span className="font-bold text-foreground">{receipt.registerNumber}</span>
              </div>
              <div className="border-t border-border/40 my-2" />
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Fine Type:</span>
                <span className="font-bold text-foreground">{receipt.fineType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Fine Amount:</span>
                <span className="font-bold text-warn">₹{receipt.amount}.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Approved By:</span>
                <span className="font-bold text-primary">{receipt.approvedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Payment Date:</span>
                <span className="font-bold text-foreground">{receipt.paymentDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground font-sans">Status:</span>
                <span className="font-bold text-present">PAID</span>
              </div>
            </div>

            {/* Receipt Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => downloadReceipt(receipt)}
                className="btn-gradient flex items-center justify-center gap-1.5 rounded-xl py-3 text-[0.8rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
              >
                <Download className="h-4 w-4" /> Download
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="border border-border bg-transparent hover:bg-surface text-muted-foreground text-[0.8rem] font-bold py-3 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>

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
