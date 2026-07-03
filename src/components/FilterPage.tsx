import { useState } from "react";
import { MONTH_NAMES } from "@/data/students";
import TopBar from "./TopBar";

interface FilterPageProps {
  username: string;
  onLogout: () => void;
  onSubmit: (filter: FilterData) => void;
}

export interface FilterData {
  sem: string;
  dept: string;
  year: string;
  studentYear: string;
  month: number;
  date: string;
}

const FilterPage = ({ username, onLogout, onSubmit }: FilterPageProps) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const [sem, setSem] = useState("");
  const [dept, setDept] = useState("");
  const [year, setYear] = useState("");
  const [studentYear, setStudentYear] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = () => {
    if (!sem || !dept || !year || !studentYear) {
      setError(true);
      return;
    }
    setError(false);
    const date = today.toLocaleDateString("en-GB");
    onSubmit({ sem, dept, year, studentYear, month: currentMonth, date });
  };

  const selectClass = "w-full appearance-none rounded-lg border border-border bg-surface px-4 py-3 text-[0.95rem] text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(79,156,249,.15)]";

  return (
    <div className="relative z-[1] flex min-h-screen flex-col">
      <TopBar username={username} onLogout={onLogout} />
      <div className="mx-auto w-full max-w-[1200px] flex-1 p-8">
        <h1 className="font-display text-[1.8rem] font-bold">Select Class Details</h1>
        <p className="mb-8 text-[0.9rem] text-muted-foreground">Choose semester, department, academic year and month</p>

        <div className="mb-6 grid grid-cols-1 gap-5 rounded-2xl border border-border bg-card p-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Semester</label>
            <select value={sem} onChange={e => setSem(e.target.value)} className={selectClass}>
              <option value="">-- Select --</option>
              {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={`Semester ${n}`}>Semester {n}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Department</label>
            <select value={dept} onChange={e => setDept(e.target.value)} className={selectClass}>
              <option value="">-- Select --</option>
              {[
                "Information Technology",
                "Artificial Intelligence and Data Science",
                "Mechanical Engineering",
                "Computer Science and Engineering",
                "Electrical and Electronics Engineering",
                "Electronics and Communication Engineering",
                "Artificial Intelligence and Machine Learning",
              ].map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Academic Year</label>
            <select value={year} onChange={e => setYear(e.target.value)} className={selectClass}>
              <option value="">-- Select --</option>
              {Array.from({ length: 31 }, (_, i) => `${2000 + i}-${String(2001 + i).slice(-2)}`).map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Year</label>
            <select value={studentYear} onChange={e => setStudentYear(e.target.value)} className={selectClass}>
              <option value="">-- Select --</option>
              {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(y => <option key={y}>{y}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Month</label>
            <div className={`${selectClass} flex items-center justify-between opacity-80 cursor-not-allowed`}>
              <span>{MONTH_NAMES[currentMonth]}</span>
              <span className="text-[0.7rem] text-muted-foreground">Auto-locked to current month</span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[0.8rem] font-medium uppercase tracking-wider text-muted-foreground">Today's Date</label>
            <div className={`${selectClass} flex items-center justify-between opacity-80 cursor-not-allowed`}>
              <span>{today.toLocaleDateString("en-GB")}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-present/15 px-2 py-0.5 text-[0.68rem] font-medium text-present">● Live</span>
            </div>
          </div>

        </div>

        <button onClick={handleSubmit} className="btn-gradient rounded-lg px-8 py-3.5 font-display text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-btn)]">
          View Students →
        </button>

        {error && <p className="mt-3 text-[0.82rem] text-warn">⚠ Please fill all fields.</p>}
      </div>
    </div>
  );
};

export default FilterPage;
