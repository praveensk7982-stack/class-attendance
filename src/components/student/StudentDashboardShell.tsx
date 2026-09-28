import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getMonthlyStats, countWorkingDays, MONTH_NAMES } from "@/data/students";
import { 
  User, 
  CalendarDays, 
  FileText, 
  DollarSign, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  Award,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

// Import student subcomponents
import StudentLeave from "./StudentLeave";
import StudentFines from "./StudentFines";

const StudentDashboardShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  });
  const [student, setStudent] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isLogged = localStorage.getItem("student_logged");
    const storedData = localStorage.getItem("student_data");
    if (isLogged !== "true" || !storedData) {
      navigate("/login/student");
    } else {
      setStudent(JSON.parse(storedData));
    }
  }, [navigate]);

  // Close sidebar on route change for mobile viewports
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("student_logged");
    localStorage.removeItem("student_data");
    navigate("/login/student");
  };

  if (!student) return null;

  const navItems = [
    { name: "My Dashboard", path: "/student/dashboard", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { name: "Attendance History", path: "/student/history", icon: <CalendarDays className="h-4.5 w-4.5" /> },
    { name: "Apply Leave", path: "/student/leave", icon: <FileText className="h-4.5 w-4.5" /> },
    { name: "Fines & Payments", path: "/student/fines", icon: <DollarSign className="h-4.5 w-4.5" /> },
  ];

  return (
    <div className="relative z-[1] flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-card border-r border-border/60 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static`}>
        <div className="flex flex-col h-full">
          {/* Header branding */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
            <span className="font-display text-lg font-extrabold tracking-tight text-gradient flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> IT LITES PORTAL
            </span>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Student mini-profile */}
          <div className="px-6 py-5 border-b border-border/40 bg-surface/30 flex items-center gap-3">
            <img 
              src={student.photo_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${student.name}`} 
              alt={student.name}
              className="h-10 w-10 rounded-xl bg-surface border border-border"
            />
            <div className="min-w-0">
              <h4 className="text-[0.85rem] font-bold truncate text-foreground">{student.name}</h4>
              <span className="text-[0.68rem] text-muted-foreground font-mono">{student.register_number}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
            {navItems.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[0.88rem] font-medium transition-all ${
                    active 
                      ? "bg-primary text-primary-foreground font-semibold shadow-[0_4px_12px_rgba(79,156,249,0.25)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-surface"
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Logout footer */}
          <div className="p-4 border-t border-border/40">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-[0.88rem] font-medium text-warn hover:bg-warn/10 transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/40 bg-background/80 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-display font-bold text-base md:text-lg">
              {navItems.find(item => item.path === location.pathname)?.name || "Overview"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border/50 bg-card px-3 py-1 text-[0.72rem] text-primary font-bold">
              Class: {student.class}
            </span>
          </div>
        </header>

        {/* Routes */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="dashboard" element={<StudentDashboardOverview student={student} />} />
            <Route path="history" element={<StudentAttendanceHistory student={student} />} />
            <Route path="leave" element={<StudentLeave student={student} />} />
            <Route path="fines" element={<StudentFines student={student} />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Student overview stats subcomponent
const StudentDashboardOverview = ({ student }: { student: any }) => {
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    leave: 0,
    pct: 0,
    wd: 0
  });
  const [loading, setLoading] = useState(true);

  // Gauge animation rings
  const circumference = 163.4;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const loadStudentStats = async () => {
      try {
        setLoading(true);
        const currentMonth = new Date().getMonth();
        const wd = countWorkingDays(currentMonth);

        // Fetch attendance history for this student
        const { data: dbData, error } = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", student.id);

        let present = 0;
        let absent = 0;
        let leave = 0;

        if (!error && dbData) {
          dbData.forEach((row: any) => {
            const status = row.status.toLowerCase();
            if (status === "present") present++;
            else if (status === "absent") absent++;
            else if (status === "leave") leave++;
          });
        } else {
          // Fallback to local storage calculated statistics
          const history = JSON.parse(localStorage.getItem("local_att_history") || "[]");
          const myHistory = history.filter((h: any) => h.student_id === student.id);
          myHistory.forEach((row: any) => {
            const status = row.status.toLowerCase();
            if (status === "present") present++;
            else if (status === "absent") absent++;
            else if (status === "leave") leave++;
          });
          
          // Seed defaults if no records are logged yet
          if (myHistory.length === 0) {
            present = Math.round(wd * 0.85);
            absent = Math.round(wd * 0.10);
            leave = Math.round(wd * 0.05);
          }
        }

        const pct = wd > 0 ? Math.round((present / wd) * 100) : 0;
        setStats({ present, absent, leave, pct, wd });

        // Ring gauge animation trigger
        setTimeout(() => {
          setOffset(circumference - (Math.min(pct, 100) / 100) * circumference);
        }, 200);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadStudentStats();
  }, [student.id]);

  const pctColor = stats.pct < 75 ? "hsl(var(--absent))" : stats.pct < 85 ? "#fbbf24" : "hsl(var(--present))";

  return (
    <div className="p-6 md:p-8 space-y-6 animate-slide-up-fast">
      {/* Student Welcome Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md bg-gradient-to-r from-card via-primary/5 to-card">
        <h3 className="font-display text-lg font-bold text-foreground">Welcome back, {student.name}!</h3>
        <p className="text-[0.78rem] text-muted-foreground mt-1">Here is a quick look at your academic year attendance statistics.</p>
      </div>

      {/* Row Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Gauge Card (1 column) */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center text-center justify-between shadow-md">
          <h4 className="self-start font-display text-[0.82rem] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Award className="h-4.5 w-4.5 text-primary" /> Overall Attendance
          </h4>

          {loading ? (
            <div className="py-10 text-muted-foreground text-[0.8rem]">Calculating...</div>
          ) : (
            <>
              <div className="relative my-4 flex h-32 w-32 items-center justify-center">
                <svg width="120" height="120" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="hsl(var(--border))" strokeWidth="4.5" />
                  <circle
                    cx="30" cy="30" r="26" fill="none"
                    stroke={pctColor}
                    strokeWidth="4.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform="rotate(-90 30 30)"
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="font-display text-2xl font-bold" style={{ color: pctColor }}>{stats.pct}%</span>
                  <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Percentage</span>
                </div>
              </div>

              <div className="text-[0.78rem] font-medium leading-relaxed mt-2" style={{ color: pctColor }}>
                {stats.pct < 75 ? "⚠ Below 75% Attendance Limit" : stats.pct < 85 ? "↗ Status: Average" : "✓ Status: Excellent"}
              </div>
            </>
          )}
        </div>

        {/* Stat Cards (2 columns) */}
        <div className="grid grid-cols-2 gap-4 md:col-span-2">
          {[
            { label: "Working Days", val: stats.wd, color: "text-primary", icon: <CalendarDays className="h-5 w-5 text-primary/70" /> },
            { label: "Days Present", val: stats.present, color: "text-present", icon: <CheckCircle className="h-5 w-5 text-present/70" /> },
            { label: "Days Absent", val: stats.absent, color: "text-absent", icon: <XCircle className="h-5 w-5 text-absent/70" /> },
            { label: "Leaves Taken", val: stats.leave, color: "text-orange-400", icon: <Clock className="h-5 w-5 text-orange-400/70" /> },
          ].map(c => (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between shadow-md">
              <div>
                <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground font-semibold">{c.label}</span>
                <div className={`font-display text-2xl font-bold mt-1 ${c.color}`}>{loading ? "..." : c.val}</div>
              </div>
              <div className="h-9 w-9 rounded-lg bg-surface border border-border flex items-center justify-center">
                {c.icon}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Student attendance history calendar subcomponent
const StudentAttendanceHistory = ({ student }: { student: any }) => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const [viewMonth, setViewMonth] = useState(currentMonth);
  const [history, setHistory] = useState<Record<string, 'present' | 'absent' | 'leave' | 'not-marked'>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const { data: dbData, error } = await supabase
          .from("attendance")
          .select("date, status")
          .eq("student_id", student.id);

        const localMap: Record<string, 'present' | 'absent' | 'leave' | 'not-marked'> = {};

        if (!error && dbData) {
          dbData.forEach((row: any) => {
            const d = new Date(row.date);
            localMap[d.toLocaleDateString("en-GB")] = row.status.toLowerCase() as any;
          });
        } else {
          // Fallback to local storage calculated statistics
          const hList = JSON.parse(localStorage.getItem("local_att_history") || "[]");
          hList.filter((h: any) => h.student_id === student.id).forEach((row: any) => {
            localMap[new Date(row.date).toLocaleDateString("en-GB")] = row.status.toLowerCase() as any;
          });
        }
        setHistory(localMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [student.id]);

  const daysInMonth = new Date(currentYear, viewMonth + 1, 0).getDate();
  const paddingLength = (new Date(currentYear, viewMonth, 1).getDay() + 6) % 7;

  return (
    <div className="p-6 md:p-8 space-y-6 animate-slide-up-fast">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-5 mb-5">
          <div>
            <h3 className="font-display text-lg font-bold">Attendance Records</h3>
            <p className="text-[0.78rem] text-muted-foreground">View status of each day this academic term</p>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-1.5">
            <button
              onClick={() => setViewMonth(m => Math.max(0, m - 1))}
              disabled={viewMonth === 0}
              className="h-7 w-7 border border-border bg-card rounded-lg flex items-center justify-center hover:text-foreground disabled:opacity-30"
            >
              ←
            </button>
            <span className="min-w-[110px] text-center font-display text-[0.82rem] font-bold">
              {MONTH_NAMES[viewMonth]} {currentYear}
            </span>
            <button
              onClick={() => setViewMonth(m => Math.min(currentMonth, m + 1))}
              disabled={viewMonth >= currentMonth}
              className="h-7 w-7 border border-border bg-card rounded-lg flex items-center justify-center hover:text-foreground disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-[0.72rem] text-muted-foreground border-b border-border/40 pb-4 mb-6">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-present" /> Present</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-absent" /> Absent</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-orange-400" /> Leave</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-border" /> Not Marked / Sunday</span>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading calendar...</div>
        ) : (
          <div className="grid grid-cols-7 gap-2 text-center">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
              <div key={d} className="text-[0.68rem] font-semibold text-muted-foreground uppercase">{d}</div>
            ))}
            
            {Array.from({ length: paddingLength }).map((_, idx) => (
              <div key={`pad-${idx}`} className="h-10" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dateObj = new Date(currentYear, viewMonth, day);
              const isSunday = dateObj.getDay() === 0;
              const key = dateObj.toLocaleDateString("en-GB");
              
              const status = isSunday ? "sunday" : (history[key] || "not-marked");

              let bg = "bg-surface border-border/40 text-muted-foreground";
              if (status === "present") bg = "bg-present/15 border-present/30 text-present font-bold shadow-[0_0_8px_rgba(34,211,160,0.1)]";
              if (status === "absent") bg = "bg-absent/15 border-absent/30 text-absent font-bold shadow-[0_0_8px_rgba(255,108,108,0.1)]";
              if (status === "leave") bg = "bg-orange-400/15 border-orange-400/30 text-orange-400 font-bold shadow-[0_0_8px_rgba(251,191,36,0.1)]";
              if (status === "sunday") bg = "bg-muted/10 border-transparent opacity-40";

              return (
                <div 
                  key={day} 
                  title={`${key}: ${status}`}
                  className={`flex h-10 items-center justify-center rounded-lg border text-[0.82rem] transition-all ${bg}`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboardShell;