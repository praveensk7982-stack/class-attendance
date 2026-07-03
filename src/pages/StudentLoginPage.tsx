import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getStudentsByYear } from "@/data/students";
import { UserCheck, AlertCircle, HelpCircle } from "lucide-react";

const StudentLoginPage = () => {
  const [registerNum, setRegisterNum] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerNum.trim()) return;

    setLoading(true);
    setError(false);

    try {
      // 1. Query Supabase
      const { data: dbStudent, error: dbError } = await supabase
        .from("students")
        .select("*")
        .eq("register_number", registerNum.trim())
        .maybeSingle();

      if (dbStudent) {
        localStorage.setItem("student_logged", "true");
        localStorage.setItem("student_data", JSON.stringify(dbStudent));
        setLoading(false);
        navigate("/student/dashboard");
        return;
      }

      // 2. Fallback to mock lists
      const semesters = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
      const departments = [
        "Information Technology",
        "Artificial Intelligence and Data Science",
        "Mechanical Engineering",
        "Computer Science and Engineering",
        "Electrical and Electronics Engineering",
        "Electronics and Communication Engineering",
        "Artificial Intelligence and Machine Learning"
      ];

      let mockMatch = null;
      for (const sem of semesters) {
        for (const dept of departments) {
          const list = getStudentsByYear(sem, dept);
          const found = list.find(s => s.reg === registerNum.trim());
          if (found) {
            mockMatch = {
              id: found.id.toString(), // string representation
              student_id: found.reg,
              name: found.name,
              register_number: found.reg,
              class: sem,
              department: found.dept,
              designation: found.designation,
              email: found.email,
              phone: found.phone,
              joining_date: found.joining_date,
              photo_url: found.photo_url
            };
            break;
          }
        }
        if (mockMatch) break;
      }

      if (mockMatch) {
        // Double check: save to Supabase if it wasn't there but matches seed, OR just log them in locally
        localStorage.setItem("student_logged", "true");
        localStorage.setItem("student_data", JSON.stringify(mockMatch));
        setLoading(false);
        navigate("/student/dashboard");
        return;
      }

      setError(true);
    } catch (err) {
      console.error("Student login validation failed:", err);
      setError(true);
    } finally {
      setLoading(false);
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
            Student Portal Access
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mb-2 block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
              <span>Register Number</span>
              <span className="text-primary/70 text-[0.68rem] lowercase font-normal">Passwordless Login</span>
            </label>
            <input
              type="text"
              required
              value={registerNum}
              onChange={e => { setRegisterNum(e.target.value); setError(false); }}
              placeholder="e.g. 961223205001"
              className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-[0.88rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-warn bg-warn/10 border border-warn/20 rounded-lg p-3 text-[0.78rem]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Register number not found in directory. Try a seeded number like "961223205001".</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gradient mt-2 w-full rounded-lg py-3.5 font-display text-sm font-bold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-btn)] disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Access Dashboard →"}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-border/50 pt-6">
          <Link to="/" className="text-[0.8rem] text-muted-foreground hover:text-primary transition-colors">
            ← Back to Portal Selection
          </Link>
        </div>

        {/* Info hints */}
        <div className="mt-5 text-[0.72rem] text-muted-foreground/60 leading-relaxed bg-surface/50 border border-border/30 rounded-xl p-4 flex gap-2.5">
          <HelpCircle className="h-4.5 w-4.5 text-primary shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Quick Tip:</span> Any valid registration number from the student tables (e.g., 961223205001 for ARINAYA A, 961223205002, etc.) can be used for demonstration.
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
