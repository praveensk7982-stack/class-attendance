import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Send, 
  User, 
  CheckCheck, 
  Check, 
  X, 
  Loader2, 
  Smartphone, 
  Volume2, 
  VolumeX,
  BellRing
} from "lucide-react";

interface WhatsAppMessage {
  id: string;
  requestId: string;
  studentId: string;
  studentName: string;
  registerNumber: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
}

const WhatsAppSimulator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play a retro synthesizer message notification ping
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio play failed:", e);
    }
  };

  useEffect(() => {
    // 1. Listen to window level custom events
    const handleNewRequestEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      const newMsg: WhatsAppMessage = {
        id: Math.random().toString(),
        requestId: detail.id,
        studentId: detail.student_id,
        studentName: detail.student_name || "Unknown Student",
        registerNumber: detail.register_number || "N/A",
        leaveType: detail.leave_type,
        fromDate: detail.from_date,
        toDate: detail.to_date,
        reason: detail.reason,
        status: detail.status || 'Pending',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => {
        // Prevent duplicate messages
        if (prev.some(m => m.requestId === newMsg.requestId)) return prev;
        return [...prev, newMsg];
      });

      if (!isOpen) {
        setUnreadCount(prev => prev + 1);
      }
      playNotificationSound();
    };

    window.addEventListener("new-leave-request", handleNewRequestEvent);
    return () => {
      window.removeEventListener("new-leave-request", handleNewRequestEvent);
    };
  }, [isOpen, soundEnabled]);

  const handleAction = async (msgId: string, action: 'Approved' | 'Rejected') => {
    setActionLoading(msgId);
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      // 1. Update status in Supabase leave_requests table
      const { error: dbErr } = await supabase
        .from("leave_requests")
        .update({ status: action })
        .eq("id", msg.requestId);

      // 2. If approved, add attendance records as 'leave'
      if (!dbErr && action === 'Approved') {
        const start = new Date(msg.fromDate);
        const end = new Date(msg.toDate);
        const dates: string[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (d.getDay() === 0) continue; // Skip Sunday
          const day = String(d.getDate()).padStart(2, "0");
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const yr = d.getFullYear();
          dates.push(`${yr}-${month}-${day}`);
        }

        for (const dateISO of dates) {
          await supabase
            .from("attendance")
            .delete()
            .eq("student_id", msg.studentId)
            .eq("date", dateISO);

          await supabase
            .from("attendance")
            .insert({
              student_id: msg.studentId,
              date: dateISO,
              status: "leave",
              is_late: false
            });
        }
      }

      // 3. Log Audit log in Supabase leave_audit_logs
      await supabase
        .from("leave_audit_logs")
        .insert({
          request_id: msg.requestId,
          student_id: msg.studentId,
          action: action,
          performed_by: "Admin (WhatsApp)",
          details: `WhatsApp interactive template response: ${action.toLowerCase()}`
        });

      // 4. Update locally in list of messages
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: action } : m));

      // 5. Fire global state refresh event so Student views reload instantly
      window.dispatchEvent(new CustomEvent("leave-status-updated", { detail: { requestId: msg.requestId, status: action } }));

      // Fallback local update if offline
      const stored = localStorage.getItem("local_leave_requests");
      if (stored) {
        const list = JSON.parse(stored);
        const updated = list.map((item: any) => {
          if (item.id === msg.requestId) {
            return { ...item, status: action };
          }
          return item;
        });
        localStorage.setItem("local_leave_requests", JSON.stringify(updated));
      }

    } catch (e) {
      console.error("WhatsApp simulation action failed:", e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[500] font-sans flex flex-col items-end">
      
      {/* Floating Toggle Icon */}
      <button
        onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-transform duration-300 hover:scale-115 ${
          isOpen ? "bg-red-500 rotate-135" : "bg-[#25D366] shadow-[#25D366]/30"
        }`}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[0.68rem] font-bold text-white animate-pulse">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Simulator Smart Phone view */}
      {isOpen && (
        <div className="animate-slide-up-fast mt-4 w-[340px] h-[520px] rounded-[36px] border-8 border-[#1e2530] bg-[#0b141a] shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
          
          {/* Smart Phone Header Notch */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 h-4 w-28 bg-[#1e2530] rounded-b-xl z-50 flex items-center justify-center">
            <div className="h-1.5 w-8 bg-zinc-800 rounded-full" />
          </div>

          {/* WhatsApp Header bar */}
          <div className="bg-[#075e54] text-white pt-6 pb-3 px-4 flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-xs font-bold border border-zinc-700">
                L
              </div>
              <div>
                <h4 className="text-[0.8rem] font-bold">IT LITES Admin Bot</h4>
                <span className="text-[0.58rem] text-[#25D366] font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] inline-block" /> online
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-white/80 hover:text-white transition-colors"
              >
                {soundEnabled ? <Volume2 className="h-4.5 w-4.5" /> : <VolumeX className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          {/* WhatsApp Chat Conversation logs */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[size:35%] bg-opacity-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-2">
                <BellRing className="h-8 w-8 text-[#075e54] opacity-50 animate-bounce" />
                <p className="text-[0.72rem] text-zinc-500">
                  No simulated messages. Apply for leave on the Student Dashboard to view the interactive notification bubble.
                </p>
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className="flex flex-col space-y-1">
                  
                  {/* WhatsApp template chat bubble */}
                  <div className="bg-[#202c33] border border-[#202c33] text-zinc-200 rounded-2xl rounded-tl-none p-3.5 max-w-[90%] shadow-md">
                    <div className="text-[0.72rem] font-bold text-[#25D366] border-b border-[#2a3942] pb-1.5 mb-2 flex items-center gap-1.5">
                      💬 INTERACTIVE NOTIFICATION
                    </div>
                    
                    <div className="text-[0.75rem] space-y-1.5 leading-relaxed font-mono">
                      <div><span className="text-zinc-500 font-sans font-semibold">Student:</span> {msg.studentName}</div>
                      <div><span className="text-zinc-500 font-sans font-semibold">Reg No:</span> {msg.registerNumber}</div>
                      <div><span className="text-zinc-500 font-sans font-semibold">Type:</span> {msg.leaveType}</div>
                      <div>
                        <span className="text-zinc-500 font-sans font-semibold">Range:</span> {msg.fromDate} to {msg.toDate}
                      </div>
                      <div className="italic text-zinc-400 bg-[#111b21] p-2 rounded-lg border border-[#2a3942] mt-1">
                        "{msg.reason}"
                      </div>
                    </div>

                    {/* Interactive Action Buttons */}
                    {msg.status === 'Pending' ? (
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-2 border-t border-[#2a3942]">
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleAction(msg.id, 'Rejected')}
                          className="flex items-center justify-center gap-1 rounded-lg bg-red-600/20 hover:bg-red-600/35 border border-red-500/30 py-2 text-[0.7rem] font-bold text-red-400 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </button>
                        <button
                          disabled={actionLoading !== null}
                          onClick={() => handleAction(msg.id, 'Approved')}
                          className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/30 py-2 text-[0.7rem] font-bold text-emerald-400 transition-colors"
                        >
                          {actionLoading === msg.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          Approve
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 pt-1.5 border-t border-[#2a3942] flex items-center justify-end gap-1 text-[0.62rem] text-zinc-500 uppercase tracking-wider font-bold">
                        <CheckCheck className={`h-3.5 w-3.5 ${msg.status === 'Approved' ? "text-emerald-500" : "text-red-500"}`} />
                        <span>Actioned: {msg.status}</span>
                      </div>
                    )}

                    <div className="text-right text-[0.58rem] text-zinc-500 mt-1.5">
                      {msg.timestamp}
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* Chat Footer Mock */}
          <div className="bg-[#1f2c34] p-3 flex items-center gap-2 border-t border-[#2d3b44]/40">
            <div className="flex-1 bg-[#2a3942] rounded-full px-4 py-1.5 text-[0.75rem] text-zinc-500 font-medium">
              Simulation Mode Only
            </div>
            <div className="h-8 w-8 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-md">
              <Send className="h-4 w-4" />
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default WhatsAppSimulator;
