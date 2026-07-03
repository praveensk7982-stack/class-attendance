import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CalendarDays, AlertCircle } from "lucide-react";

const AdminLoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === "information technology" && password.trim() === "LITES@2008") {
      localStorage.setItem("admin_logged", "true");
      localStorage.setItem("logged_username", username.trim());
      navigate("/admin/dashboard");
    } else {
      setError(true);
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen items-center justify-center p-6 md:p-8">
      <div className="animate-slide-up w-full max-w-[420px] rounded-[24px] border border-border bg-card p-10 shadow-[var(--shadow-card)]">
        
        {/* Branding header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-2">
            <span className="font-display text-2xl font-extrabold tracking-tight text-gradient">IT LITES</span>
          </Link>
          <p className="text-[0.82rem] text-muted-foreground uppercase tracking-wider font-semibold">
            Admin Portal Access
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={e => { setUsername(e.target.value); setError(false); }}
              placeholder="Enter admin username"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => { setPassword(e.target.value); setError(false); }}
              placeholder="••••••••"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-warn bg-warn/10 border border-warn/20 rounded-lg p-3 text-[0.78rem]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Invalid admin username or password.</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-gradient mt-2 w-full rounded-lg py-3.5 font-display text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-btn)]"
          >
            Authenticate Admin →
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border/50 pt-6">
          <Link to="/" className="text-[0.8rem] text-muted-foreground hover:text-primary transition-colors">
            ← Back to Portal Selection
          </Link>
        </div>

        <p className="mt-4 text-center text-[0.75rem] text-muted-foreground/60 bg-surface/50 border border-border/30 rounded-lg py-2">
          Demo Creds: information technology / LITES@2008
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
