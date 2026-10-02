import { Link } from "react-router-dom";
import { UserCheck, ShieldAlert, CalendarDays } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="relative z-[1] flex min-h-screen flex-col items-center justify-center p-6 md:p-8">
      {/* Background radial effects */}
      <div className="absolute inset-0 bg-background pointer-events-none -z-10" />

      {/* Small admin link, top right */}
      <Link
        to="/login/admin"
        className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-[0.75rem] font-semibold text-muted-foreground transition-all hover:border-accent/50 hover:text-accent"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        Admin
      </Link>

      <div className="animate-slide-up w-full max-w-[800px] text-center">
        {/* Title / Brand */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[0.8rem] font-semibold text-primary">
          <CalendarDays className="h-4 w-4" />
          <span>LITES Attendance Management App</span>
        </div>
        
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-gradient sm:text-5xl md:text-6xl mb-6">
          IT LITES PORTAL
        </h1>
        <p className="mx-auto max-w-[560px] text-[1rem] text-muted-foreground mb-12">
          A modern, secure, and automated portal for marking attendance, tracking leave applications, and managing late fines.
        </p>

        {/* Portal Cards Selector */}
        <div className="mx-auto grid max-w-[420px] grid-cols-1 gap-6">
          {/* Student Portal Card */}
          <Link
            to="/login/student"
            className="group relative overflow-hidden rounded-[24px] border border-border bg-card p-8 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_20px_50px_rgba(79,156,249,0.15)]"
          >
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all" />
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/25 text-primary">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="font-display text-xl font-bold mb-2 group-hover:text-primary transition-colors">
              Student Portal →
            </h3>
            <p className="text-[0.88rem] text-muted-foreground leading-relaxed">
              Log in with your Register Number to view your dashboard, check attendance records, apply for leave, and review pending fines.
            </p>
          </Link>
        </div>

        {/* Footer info */}
        <div className="mt-16 text-[0.78rem] text-muted-foreground">
          © {new Date().getFullYear()} IT LITES. Powered by React + Supabase. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LandingPage;