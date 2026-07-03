import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStudentsByYear } from "@/data/students";
import { 
  Users, 
  CalendarDays, 
  FileCheck2, 
  DollarSign, 
  LayoutDashboard, 
  LogOut, 
  Menu, 
  X, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock,
  Sparkles
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// Import admin sub-views
import AdminStudents from "./AdminStudents";
import AdminAttendance from "./AdminAttendance";
import AdminLeaveRequests from "./AdminLeaveRequests";
import AdminFines from "./AdminFines";

const AdminDashboardShell = () => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  });
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect if not logged in
  useEffect(() => {
    const isLogged = localStorage.getItem("admin_logged");
    if (isLogged !== "true") {
      navigate("/login/admin");
    }
  }, [navigate]);

  // Close sidebar on route change for mobile viewports
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("admin_logged");
    localStorage.removeItem("logged_username");
    navigate("/login/admin");
  };

  const navItems = [
    { name: "Overview", path: "/admin/dashboard", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { name: "Student Directory", path: "/admin/students", icon: <Users className="h-4.5 w-4.5" /> },
    { name: "Mark Attendance", path: "/admin/attendance", icon: <CalendarDays className="h-4.5 w-4.5" /> },
    { name: "Leave Requests", path: "/admin/leave-requests", icon: <FileCheck2 className="h-4.5 w-4.5" /> },
    { name: "Late & Leave Fines", path: "/admin/fines", icon: <DollarSign className="h-4.5 w-4.5" /> },
  ];

  return (
    <div className="relative z-[1] flex min-h-screen bg-background text-foreground">
      {/* Sidebar background overlay on mobile */}
      {!sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(true)}
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-card border-r border-border/60 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 lg:static`}>
        <div className="flex flex-col h-full">
          {/* Header branding */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
            <span className="font-display text-lg font-extrabold tracking-tight text-gradient flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-primary" /> IT LITES ADMIN
            </span>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
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
              <span>Logout Admin</span>
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
              {navItems.find(item => item.path === location.pathname)?.name || "Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border border-border/50 bg-card px-4 py-1.5 text-[0.78rem] text-muted-foreground">
              Logged as: <span className="font-semibold text-foreground">IT Admin</span>
            </div>
          </div>
        </header>

        {/* Dynamic Nested Route Rendering */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="dashboard" element={<AdminDashboardOverview />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="attendance" element={<AdminAttendance />} />
            <Route path="leave-requests" element={<AdminLeaveRequests />} />
            <Route path="fines" element={<AdminFines />} />
            <Route path="*" element={<Navigate to="dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

// Admin overview tab subcomponent
const AdminDashboardOverview = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Dynamic statistics calculations
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        // 1. Fetch Students
        const { data: dbStudents } = await supabase.from("students").select("id");
        const dbTotal = dbStudents?.length || 0;
        
        // 2. Fetch Today's Attendance
        const todayISO = new Date().toISOString().split("T")[0];
        const { data: dbAttendance } = await supabase
          .from("attendance")
          .select("status")
          .eq("date", todayISO);
          
        let present = 0;
        let absent = 0;
        let leave = 0;

        if (dbAttendance && dbAttendance.length > 0) {
          dbAttendance.forEach((row: any) => {
            const stat = row.status.toLowerCase();
            if (stat === "present") present++;
            else if (stat === "absent") absent++;
            else if (stat === "leave") leave++;
          });
        }

        // If today is empty, simulate mock statistics based on seeded values
        const fallbackTotal = dbTotal || getStudentsByYear("3rd Year").length;
        setStats({
          totalStudents: fallbackTotal,
          presentCount: present || Math.round(fallbackTotal * 0.85),
          absentCount: absent || Math.round(fallbackTotal * 0.10),
          leaveCount: leave || Math.round(fallbackTotal * 0.05),
        });
      } catch (err) {
        console.error("Failed to load statistics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Trend data for area charts
  const trendData = [
    { day: "Mon", Present: 92, Absent: 5, Leave: 3 },
    { day: "Tue", Present: 88, Absent: 8, Leave: 4 },
    { day: "Wed", Present: 95, Absent: 3, Leave: 2 },
    { day: "Thu", Present: 90, Absent: 6, Leave: 4 },
    { day: "Fri", Present: 91, Absent: 5, Leave: 4 },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8">
      {/* Overview stats cards grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Students", val: stats.totalStudents, color: "text-primary", icon: <Users className="h-5 w-5 text-primary/70" /> },
          { label: "Today Present", val: stats.presentCount, color: "text-present", icon: <CheckCircle className="h-5 w-5 text-present/70" /> },
          { label: "Today Absent", val: stats.absentCount, color: "text-absent", icon: <XCircle className="h-5 w-5 text-absent/70" /> },
          { label: "Approved Leaves", val: stats.leaveCount, color: "text-orange-400", icon: <Clock className="h-5 w-5 text-orange-400/70" /> },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-6 flex items-center justify-between shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
            <div>
              <div className="text-[0.68rem] uppercase tracking-wider text-muted-foreground font-semibold">
                {card.label}
              </div>
              <div className={`mt-1 font-display text-[1.8rem] font-bold ${card.color}`}>
                {loading ? "..." : card.val}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-surface border border-border flex items-center justify-center">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Recharts Area Flow Visualizer */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-6">
          <h3 className="font-display font-bold text-[1.05rem] flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-primary" /> Attendance Metrics Weekly Trend
          </h3>
          <p className="text-[0.78rem] text-muted-foreground">Percentage overview of student attendance statistics</p>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--present))" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="hsl(var(--present))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#223049" />
              <XAxis dataKey="day" stroke="#687b9e" fontSize={11} />
              <YAxis stroke="#687b9e" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
              <Area type="monotone" dataKey="Present" stroke="hsl(var(--present))" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardShell;
