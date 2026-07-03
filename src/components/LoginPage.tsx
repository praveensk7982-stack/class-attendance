import { useState } from "react";

interface LoginPageProps {
  onLogin: (username: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (username.trim() === "information technology" && password.trim() === "LITES@2008") {
      onLogin(username.trim());
    } else {
      setError(true);
    }
  };

  return (
    <div className="relative z-[1] flex min-h-screen items-center justify-center p-8">
      <div className="animate-slide-up w-full max-w-[420px] rounded-[20px] border border-border bg-card p-10 shadow-[var(--shadow-card)]">
        <h1 className="font-display text-[1.8rem] font-extrabold tracking-tight text-gradient">IT LITES</h1>
        <p className="mb-10 text-[0.85rem] text-muted-foreground">Attendance Management System</p>

        <div className="mb-5">
          <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value); setError(false); }}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.95rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.95rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
          />
        </div>

        <button
          onClick={handleLogin}
          className="btn-gradient mt-2 w-full rounded-lg py-3.5 font-display text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-btn)]"
        >
          Sign In →
        </button>

        {error && (
          <p className="mt-3 text-center text-[0.82rem] text-warn">⚠ Invalid credentials.</p>
        )}

        <p className="mt-6 text-center text-[0.78rem] text-muted-foreground">
          Login: information technology / LITES@2008
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
