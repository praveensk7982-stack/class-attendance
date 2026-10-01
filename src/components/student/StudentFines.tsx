import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MONTH_NAMES } from "@/data/students";
import { QRCodeSVG } from "qrcode.react";
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
  FileText,
  ArrowLeft,
  QrCode
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

interface FineListItem {
  id: string;
  fineType: 'Leave Fine' | 'Interval Fine';
  reason: string;
  amount: number;
  date: string;
  status: 'Paid' | 'Unpaid';
  created_at: string;
}

// UPI payee details for each approver
const UPI_PAYEES: Record<'HOD' | 'Class Advisor', { name: string; vpa: string }> = {
  HOD: {
    name: "Praveen S",
    vpa: "praveen.sk.7982@okhdfcbank"
  },
  'Class Advisor': {
    name: "Kesavan Moorthy K",
    vpa: "kesavanmoorthyk991-4@oksbi"
  }
};

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

  const [studentUuid, setStudentUuid] = useState<string | null>(null);
  const [fineListItems, setFineListItems] = useState<FineListItem[]>([]);

  // Derived from unpaid rows in fine_entries
  const [leavePaid, setLeavePaid] = useState(false);
  const [intervalPaid, setIntervalPaid] = useState(false);
  
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);

  // New: which step of the approval modal we're on, and who was picked
  const [modalStep, setModalStep] = useState<'select' | 'qr'>('select');
  const [selectedApprover, setSelectedApprover] = useState<'HOD' | 'Class Advisor' | null>(null);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const loadFinesDetails = async () => {
    try {
      setLoading(true);
      // Resolve the student's database UUID (mock/local students have non-UUID ids)
      const isUuid = (val: any) =>
        typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
      let dbStudentUuid: string | null = isUuid(student.id) ? student.id : null;

      if (!dbStudentUuid) {
        const regNo = student.register_number || student.reg || student.student_id;
        if (regNo) {
          const { data: dbStudent } = await supabase
            .from("students")
            .select("id")
            .eq("register_number", regNo)
            .maybeSingle();
          if (dbStudent?.id) dbStudentUuid = dbStudent.id;
        }
      }
      setStudentUuid(dbStudentUuid);

      if (!dbStudentUuid) {
        setFineListItems([]);
        setFines({ lateDays: 0, lateFine: 0, absentDays: 0, absentFine: 0, totalFine: 0, paymentStatus: 'Paid' });
        setLeavePaid(true);
        setIntervalPaid(true);
        return;
      }

      // One row per fine
      const { data: entries, error: entErr } = await supabase
        .from("fine_entries")
        .select("id, type, amount, status, created_at")
        .eq("student_id", dbStudentUuid)
        .order("created_at", { ascending: false });
      if (entErr) throw entErr;

      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' });

      const itemsList: FineListItem[] = (entries ?? []).map((e: any) => ({
        id: e.id,
        fineType: e.type === 'Late' ? 'Interval Fine' : 'Leave Fine',
        reason: e.type === 'Late' ? 'Interval Late Entry Fine (Created by Admin)' : 'Unexcused Absent Fine',
        amount: Number(e.amount),
        date: fmt(e.created_at),
        status: e.status,
        created_at: e.created_at
      }));
      setFineListItems(itemsList);

      const sumOf = (t: FineListItem['fineType'], st: FineListItem['status']) =>
        itemsList.filter(i => i.fineType === t && i.status === st).reduce((acc, i) => acc + i.amount, 0);

      const lateFine = sumOf('Interval Fine', 'Unpaid');
      const absentFine = sumOf('Leave Fine', 'Unpaid');

      setFines({
        lateDays: itemsList.filter(i => i.fineType === 'Interval Fine').length,
        lateFine,
        absentDays: itemsList.filter(i => i.fineType === 'Leave Fine').length,
        absentFine,
        totalFine: lateFine + absentFine,
        paymentStatus: lateFine + absentFine === 0 ? 'Paid' : 'Unpaid'
      });
      setLeavePaid(absentFine === 0);
      setIntervalPaid(lateFine === 0);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFinesDetails();

    const channel = supabase
      .channel(`student-fines-realtime-${student.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fine_entries' }, () => {
        loadFinesDetails();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [student.id]);

  // Step 1: student picks who they're paying -> move to QR step
  const handleSelectApprover = (approver: 'HOD' | 'Class Advisor') => {
    setSelectedApprover(approver);
    setModalStep('qr');
  };

  const handleBackToSelect = () => {
    setModalStep('select');
    setSelectedApprover(null);
  };

  const closeApprovalModal = () => {
    if (paying) return;
    setShowApprovalModal(false);
    setModalStep('select');
    setSelectedApprover(null);
  };

  // Step 2: after student confirms they've completed the UPI payment
  const handleConfirmPayment = async () => {
    if (!selectedApprover || !studentUuid) return;
    const approver = selectedApprover;
    setPaying(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1200));

      const isPayingLeave = activeTab === 'leave';
      const targetType = isPayingLeave ? 'Leave Fine' : 'Interval Fine';
      const items = fineListItems.filter(i => i.fineType === targetType && i.status === 'Unpaid');
      if (items.length === 0) throw new Error("Nothing to pay");
      const amount = items.reduce((acc, i) => acc + i.amount, 0);

      // Only the rows shown on screen become Paid. Fines added later stay Unpaid.
      const { error } = await supabase
        .from("fine_entries")
        .update({ status: 'Paid', paid_at: new Date().toISOString() })
        .in("id", items.map(i => i.id))
        .eq("status", "Unpaid");
      if (error) throw error;

      const recId = `REC-${Math.floor(100000 + Math.random() * 900000)}`;
      setReceipt({
        receiptId: recId,
        studentName: student.name,
        registerNumber: student.register_number,
        fineType: targetType,
        amount,
        approvedBy: approver,
        paymentDate: new Date().toLocaleString(),
        status: 'Paid'
      });

      try {
        await supabase.from("leave_audit_logs").insert({
          student_id: studentUuid,
          action: 'Approved',
          performed_by: 'Admin',
          details: `Fine Payment: ${targetType} of ₹${amount} paid via UPI to ${approver}. Status: Paid. Receipt ID: ${recId}`
        });
      } catch (logErr) {
        console.error(logErr);
      }

      setShowApprovalModal(false);
      setModalStep('select');
      setSelectedApprover(null);
      setShowReceiptModal(true);
      await loadFinesDetails();
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

  // Build the UPI deep link for whichever approver is selected
  const buildUpiLink = () => {
    if (!selectedApprover) return "";
    const payee = UPI_PAYEES[selectedApprover];
    const amount = getActiveTabFineAmount();
    const note = `${activeTab === 'leave' ? 'Leave' : 'Interval'} Fine - ${student.register_number}`;
    return `upi://pay?pa=${encodeURIComponent(payee.vpa)}&pn=${encodeURIComponent(payee.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
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

                {fines.absentFine > 0 && !leavePaid ? (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-gradient mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md animate-pulse"
                  >
                    <CreditCard className="h-4.5 w-4.5" /> Pay Fine
                  </button>
                ) : (
                  <button
                    disabled
                    className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold bg-[#1e2530] text-muted-foreground border border-border/40 cursor-not-allowed opacity-40"
                  >
                    No Fine to Pay
                  </button>
                )}
              </div>

              {/* Itemized Fine Statement Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <h4 className="font-display text-[0.95rem] font-bold flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-primary" /> Admin Fine Records & Statement
                  </h4>
                  <span className="text-[0.72rem] text-muted-foreground">Auto-synced with Database</span>
                </div>

                {fineListItems.filter(i => i.fineType === 'Leave Fine').length === 0 ? (
                  <div className="py-8 text-center text-[0.82rem] text-muted-foreground">
                    No Leave Fine records created for this student.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-surface text-muted-foreground text-[0.72rem] font-bold uppercase tracking-wider border-b border-border/50">
                          <th className="px-4 py-3 text-left">Fine Description / Reason</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Amount</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fineListItems.filter(i => i.fineType === 'Leave Fine').map((item) => (
                          <tr key={item.id} className="border-b border-border/30 text-[0.82rem] hover:bg-surface/30 transition-all">
                            <td className="px-4 py-3 font-semibold text-foreground">{item.reason}</td>
                            <td className="px-4 py-3 text-muted-foreground">{item.date}</td>
                            <td className="px-4 py-3 font-mono font-bold text-warn">₹{item.amount}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${
                                item.status === 'Paid'
                                  ? "bg-present/15 text-present border border-present/20"
                                  : "bg-absent/15 text-absent border border-absent/20 animate-pulse"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.status !== 'Paid' ? (
                                <button
                                  onClick={() => setShowApprovalModal(true)}
                                  className="rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-3 py-1 text-[0.75rem] font-bold transition-all inline-flex items-center gap-1"
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Pay Now
                                </button>
                              ) : (
                                <span className="text-[0.75rem] text-present font-bold">Cleared</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

                {fines.lateFine > 0 && !intervalPaid ? (
                  <button
                    onClick={() => setShowApprovalModal(true)}
                    className="btn-gradient mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md animate-pulse"
                  >
                    <CreditCard className="h-4.5 w-4.5" /> Pay Fine
                  </button>
                ) : (
                  <button
                    disabled
                    className="mt-6 w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.88rem] font-bold bg-[#1e2530] text-muted-foreground border border-border/40 cursor-not-allowed opacity-40"
                  >
                    No Fine to Pay
                  </button>
                )}
              </div>

              {/* Itemized Fine Statement Card */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-md lg:col-span-3 space-y-4">
                <div className="flex items-center justify-between border-b border-border/40 pb-4">
                  <h4 className="font-display text-[0.95rem] font-bold flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-primary" /> Admin Fine Records & Statement
                  </h4>
                  <span className="text-[0.72rem] text-muted-foreground">Auto-synced with Database</span>
                </div>

                {fineListItems.filter(i => i.fineType === 'Interval Fine').length === 0 ? (
                  <div className="py-8 text-center text-[0.82rem] text-muted-foreground">
                    No Interval Fine records created for this student.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-surface text-muted-foreground text-[0.72rem] font-bold uppercase tracking-wider border-b border-border/50">
                          <th className="px-4 py-3 text-left">Fine Description / Reason</th>
                          <th className="px-4 py-3 text-left">Date</th>
                          <th className="px-4 py-3 text-left">Amount</th>
                          <th className="px-4 py-3 text-center">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fineListItems.filter(i => i.fineType === 'Interval Fine').map((item) => (
                          <tr key={item.id} className="border-b border-border/30 text-[0.82rem] hover:bg-surface/30 transition-all">
                            <td className="px-4 py-3 font-semibold text-foreground">{item.reason}</td>
                            <td className="px-4 py-3 text-muted-foreground">{item.date}</td>
                            <td className="px-4 py-3 font-mono font-bold text-warn">₹{item.amount}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider ${
                                item.status === 'Paid'
                                  ? "bg-present/15 text-present border border-present/20"
                                  : "bg-absent/15 text-absent border border-absent/20 animate-pulse"
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.status !== 'Paid' ? (
                                <button
                                  onClick={() => setShowApprovalModal(true)}
                                  className="rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 px-3 py-1 text-[0.75rem] font-bold transition-all inline-flex items-center gap-1"
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Pay Now
                                </button>
                              ) : (
                                <span className="text-[0.75rem] text-present font-bold">Cleared</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}

      {/* Modern Approval / UPI QR Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-fade-in" onClick={e => e.target === e.currentTarget && closeApprovalModal()}>
          <div className="w-full max-w-[420px] rounded-[24px] border border-border bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up-fast p-6 space-y-6">
            
            {/* STEP 1: Pick who you're paying */}
            {modalStep === 'select' && (
              <>
                <div className="text-center space-y-2">
                  <div className="h-12 w-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary mx-auto">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">Pay Fine Via UPI</h3>
                  <p className="text-[0.78rem] text-muted-foreground px-4">
                    Who would you like to pay this fine to? A UPI QR code will be shown next.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => handleSelectApprover('Class Advisor')}
                    className="w-full flex items-center justify-between border border-border/60 hover:border-primary/80 bg-surface/50 hover:bg-primary/5 rounded-xl px-4 py-3.5 text-[0.85rem] font-bold text-foreground transition-all group"
                  >
                    <span>Class Advisor</span>
                    <span className="text-[0.7rem] text-muted-foreground group-hover:text-primary transition-colors font-semibold">Select ➔</span>
                  </button>
                  
                  <button
                    onClick={() => handleSelectApprover('HOD')}
                    className="w-full flex items-center justify-between border border-border/60 hover:border-primary/80 bg-surface/50 hover:bg-primary/5 rounded-xl px-4 py-3.5 text-[0.85rem] font-bold text-foreground transition-all group"
                  >
                    <span>HOD (Head of Department)</span>
                    <span className="text-[0.7rem] text-muted-foreground group-hover:text-primary transition-colors font-semibold">Select ➔</span>
                  </button>
                </div>

                <button
                  onClick={closeApprovalModal}
                  className="w-full border border-border bg-transparent hover:bg-surface text-muted-foreground text-[0.82rem] font-semibold py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </>
            )}

            {/* STEP 2: Show UPI QR code to scan */}
            {modalStep === 'qr' && selectedApprover && (
              <>
                <div className="text-center space-y-2">
                  <div className="h-12 w-12 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center text-primary mx-auto">
                    <QrCode className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-foreground">Scan to Pay {selectedApprover}</h3>
                  <p className="text-[0.78rem] text-muted-foreground px-4">
                    Open Google Pay, PhonePe or any UPI app and scan this code
                  </p>
                </div>

                {!paying ? (
                  <>
                    {/* QR code with transparent background */}
                    <div className="flex justify-center py-2">
                      <div className="rounded-2xl border border-border/60 bg-surface/30 p-5">
                        <QRCodeSVG
                          value={buildUpiLink()}
                          size={200}
                          bgColor="transparent"
                          fgColor="#ffffff"
                          level="M"
                          includeMargin={false}
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-surface/40 p-4 space-y-2 text-[0.82rem]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paying To:</span>
                        <span className="font-bold text-foreground">{UPI_PAYEES[selectedApprover].name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">UPI ID:</span>
                        <span className="font-mono font-bold text-foreground text-[0.75rem]">{UPI_PAYEES[selectedApprover].vpa}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-bold text-warn text-[1rem]">₹{getActiveTabFineAmount()}</span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <button
                        onClick={handleConfirmPayment}
                        className="btn-gradient w-full flex items-center justify-center gap-2 rounded-xl py-3 font-display text-[0.85rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
                      >
                        <CheckCircle className="h-4.5 w-4.5" /> I've Completed the Payment
                      </button>
                      <button
                        onClick={handleBackToSelect}
                        className="w-full flex items-center justify-center gap-1.5 border border-border bg-transparent hover:bg-surface text-muted-foreground text-[0.8rem] font-semibold py-2.5 rounded-xl transition-colors"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center space-y-3 text-muted-foreground text-[0.82rem]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span>Confirming your payment...</span>
                  </div>
                )}
              </>
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