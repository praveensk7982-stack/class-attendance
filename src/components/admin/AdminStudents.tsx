import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStudentsByYear } from "@/data/students";
import * as XLSX from "xlsx";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  Check, 
  X,
  Mail,
  Phone
} from "lucide-react";

interface DbStudent {
  id: string;
  student_id: string;
  name: string;
  register_number: string;
  class: string;
  department: string;
  designation?: string;
  email?: string;
  phone?: string;
  joining_date?: string;
  photo_url?: string;
}

const AdminStudents = () => {
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<DbStudent | null>(null);
  
  // Form values
  const [formName, setFormName] = useState("");
  const [formReg, setFormReg] = useState("");
  const [formClass, setFormClass] = useState("3rd Year");
  const [formDept, setFormDept] = useState("Information Technology");
  const [formDesign, setFormDesign] = useState("Software Engineer");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formJoin, setFormJoin] = useState(new Date().toISOString().split("T")[0]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [toast, setToast] = useState<{ msg: string; success: boolean } | null>(null);

  const triggerToast = (msg: string, success: boolean) => {
    setToast({ msg, success });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchStudents = async () => {
    try {
      setLoading(true);
      // Try to load from Supabase
      const { data: dbData, error } = await supabase
        .from("students")
        .select("*");

      if (!error && dbData && dbData.length > 0) {
        // Enrich dbData with display fallback properties (email, phone, etc.)
        const enriched = dbData.map(s => ({
          ...s,
          designation: s.designation || "Student",
          email: s.email || `${s.register_number}@lites.edu`,
          phone: s.phone || "9876543210",
          joining_date: s.joining_date || new Date(s.created_at || Date.now()).toISOString().split("T")[0],
          photo_url: s.photo_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(s.name)}`
        }));
        setStudents(enriched as DbStudent[]);
      } else {
        // Fallback to local storage or seeding
        const stored = localStorage.getItem("local_students");
        if (stored) {
          setStudents(JSON.parse(stored));
        } else {
          // Generate default mock data
          const list3 = getStudentsByYear("3rd Year", "Information Technology");
          const list2 = getStudentsByYear("2nd Year", "Information Technology");
          const merged = [...list3, ...list2].map((s, idx) => ({
            id: s.id.toString(),
            student_id: s.reg,
            name: s.name,
            register_number: s.reg,
            class: s.reg.startsWith("961223") ? "3rd Year" : "2nd Year",
            department: s.dept,
            designation: s.designation,
            email: s.email,
            phone: s.phone,
            joining_date: s.joining_date,
            photo_url: s.photo_url
          }));
          localStorage.setItem("local_students", JSON.stringify(merged));
          setStudents(merged);
        }
      }
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const syncStateAndLocal = (newStudents: DbStudent[]) => {
    setStudents(newStudents);
    localStorage.setItem("local_students", JSON.stringify(newStudents));
  };

  const resetForm = () => {
    setFormName("");
    setFormReg("");
    setFormClass("3rd Year");
    setFormDept("Information Technology");
    setFormDesign("Software Engineer");
    setFormEmail("");
    setFormPhone("");
    setFormJoin(new Date().toISOString().split("T")[0]);
    setFormError("");
  };



  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[];

        const parsed: any[] = [];
        for (let i = 4; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length < 3) continue;
          const regNo = String(row[1] || "").trim();
          const name = String(row[2] || "").trim();
          if (!regNo || regNo === "undefined" || regNo.length < 5) continue;

          parsed.push({
            student_id: regNo,
            name: name,
            register_number: regNo,
            class: "2nd Year",
            department: "Information Technology"
          });
        }

        const currentRegs = new Set(students.map(s => s.register_number));
        const toInsert = parsed.filter(p => !currentRegs.has(p.register_number));

        if (toInsert.length > 0) {
          const { data, error } = await supabase
            .from("students")
            .insert(toInsert)
            .select();

          if (!error && data) {
            triggerToast(`Successfully imported ${data.length} new students! ✓`, true);
            await fetchStudents();
          } else {
            // Local Storage fallback
            const enrichedToInsert = toInsert.map(t => ({
              ...t,
              id: Math.random().toString(),
              designation: "Student",
              email: `${t.register_number}@lites.edu`,
              phone: "9876543210",
              joining_date: new Date().toISOString().split("T")[0],
              photo_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(t.name)}`
            }));
            const updated = [...enrichedToInsert, ...students];
            syncStateAndLocal(updated);
            triggerToast(`Imported ${toInsert.length} students locally! ✓`, true);
          }
        } else {
          triggerToast("All students in the Excel file already exist.", false);
        }
      } catch (err) {
        console.error(err);
        triggerToast("Failed to parse Excel file.", false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formReg.trim() || !formEmail.trim() || !formPhone.trim()) {
      setFormError("All required fields must be filled.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    // Schema-valid columns for database insert
    const newStudentDb = {
      student_id: formReg.trim(),
      name: formName.trim(),
      register_number: formReg.trim(),
      class: formClass,
      department: formDept
    };

    try {
      // 1. Try Supabase Insert
      const { data, error } = await supabase
        .from("students")
        .insert([newStudentDb])
        .select();

      if (!error && data && data.length > 0) {
        const enriched = {
          ...data[0],
          designation: formDesign,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          joining_date: formJoin,
          photo_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(formName.trim())}`
        };
        setStudents(prev => [enriched as DbStudent, ...prev]);
        triggerToast(`Added ${formName} successfully to Database ✓`, true);
      } else {
        // Fallback local storage insert
        const newLocal = { 
          ...newStudentDb, 
          id: Math.random().toString(),
          designation: formDesign,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          joining_date: formJoin,
          photo_url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(formName.trim())}`
        };
        const updatedList = [newLocal, ...students];
        syncStateAndLocal(updatedList);
        triggerToast(`Added ${formName} locally ✓`, true);
      }
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError("Operation failed. Check inputs.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (student: DbStudent) => {
    setSelectedStudent(student);
    setFormName(student.name);
    setFormReg(student.register_number);
    setFormClass(student.class);
    setFormDept(student.department);
    setFormDesign(student.designation || "Software Engineer");
    setFormEmail(student.email || "");
    setFormPhone(student.phone || "");
    setFormJoin(student.joining_date || new Date().toISOString().split("T")[0]);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    if (!formName.trim() || !formReg.trim() || !formEmail.trim() || !formPhone.trim()) {
      setFormError("All required fields must be filled.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    // Schema-valid columns for database update
    const updatedDataDb = {
      name: formName.trim(),
      register_number: formReg.trim(),
      class: formClass,
      department: formDept
    };

    try {
      // 1. Try Supabase Update
      const { data, error } = await supabase
        .from("students")
        .update(updatedDataDb)
        .eq("register_number", selectedStudent.register_number)
        .select();

      if (!error && data && data.length > 0) {
        const enriched = {
          ...data[0],
          designation: formDesign,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          joining_date: formJoin,
          photo_url: selectedStudent.photo_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(formName.trim())}`
        };
        setStudents(prev => prev.map(s => s.register_number === selectedStudent.register_number ? (enriched as DbStudent) : s));
        triggerToast(`Updated profile for ${formName} ✓`, true);
      } else {
        // Fallback local update
        const updatedList = students.map(s => s.register_number === selectedStudent.register_number ? { 
          ...s, 
          ...updatedDataDb,
          designation: formDesign,
          email: formEmail.trim(),
          phone: formPhone.trim(),
          joining_date: formJoin,
          photo_url: selectedStudent.photo_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(formName.trim())}`
        } : s);
        syncStateAndLocal(updatedList);
        triggerToast(`Updated ${formName} locally ✓`, true);
      }
      setShowEditModal(false);
      setSelectedStudent(null);
      resetForm();
    } catch (err) {
      console.error(err);
      setFormError("Failed to update student.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (student: DbStudent) => {
    if (!confirm(`Are you sure you want to remove ${student.name}? This will delete all their records.`)) return;

    try {
      // 1. Try Supabase delete
      const { error } = await supabase
        .from("students")
        .delete()
        .eq("register_number", student.register_number);

      if (!error) {
        setStudents(prev => prev.filter(s => s.register_number !== student.register_number));
        triggerToast(`Deleted ${student.name} from Database ✓`, true);
      } else {
        // Fallback local delete
        const updatedList = students.filter(s => s.register_number !== student.register_number);
        syncStateAndLocal(updatedList);
        triggerToast(`Deleted ${student.name} locally ✓`, true);
      }
    } catch (err) {
      console.error(err);
      triggerToast("Failed to delete student.", false);
    }
  };

  // Search filter
  const filteredStudents = students.filter(s => {
    const query = search.toLowerCase();
    const matchesSearch = s.name.toLowerCase().includes(query) || s.register_number.includes(query);
    const matchesClass = classFilter ? s.class === classFilter : true;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Search and Filters Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name or reg no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-surface text-[0.82rem] outline-none focus:border-primary"
            />
          </div>
          
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none"
          >
            <option value="">All Classes</option>
            <option value="1st Year">1st Year</option>
            <option value="2nd Year">2nd Year</option>
            <option value="3rd Year">3rd Year</option>
            <option value="4th Year">4th Year</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="border border-border bg-surface hover:bg-surface/80 text-foreground flex items-center gap-1.5 rounded-xl px-4 py-2 text-[0.82rem] font-bold cursor-pointer transition-all shadow-sm">
            <Plus className="h-4 w-4 text-primary" /> Import Excel
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportExcel}
              className="hidden"
            />
          </label>

          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="btn-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-[0.82rem] font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md"
          >
            <Plus className="h-4 w-4" /> Add Student
          </button>
        </div>
      </div>

      {/* Student List Grid / Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Loading student database...
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          No students found matching your criteria.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface text-muted-foreground text-[0.72rem] font-bold uppercase tracking-wider border-b border-border/50">
                  <th className="px-6 py-4 text-left">Student Info</th>
                  <th className="px-6 py-4 text-left">Register Number</th>
                  <th className="px-6 py-4 text-left">Class / Department</th>
                  <th className="px-6 py-4 text-left">Contact info</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <tr key={student.register_number} className="border-b border-border/40 hover:bg-surface/30 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.photo_url || `https://api.dicebear.com/7.x/lorelei/svg?seed=${student.name}`} 
                          alt={student.name}
                          className="h-10 w-10 rounded-xl bg-surface border border-border object-cover"
                        />
                        <div>
                          <h4 className="text-[0.88rem] font-bold text-foreground">{student.name}</h4>
                          <span className="text-[0.7rem] text-muted-foreground">{student.designation || "Student"}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-[0.85rem] font-mono text-muted-foreground">
                      {student.register_number}
                    </td>

                    <td className="px-6 py-4 text-[0.85rem]">
                      <div>{student.class}</div>
                      <div className="text-[0.72rem] text-muted-foreground">{student.department}</div>
                    </td>

                    <td className="px-6 py-4 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 text-primary" /> {student.email}
                      </div>
                      <div className="flex items-center gap-1.5 text-[0.78rem] text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 text-primary" /> {student.phone}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(student)}
                          className="p-2 rounded-lg border border-border bg-surface text-muted-foreground hover:text-primary transition-colors"
                          title="Edit Student Profile"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(student)}
                          className="p-2 rounded-lg border border-border bg-surface text-muted-foreground hover:text-warn transition-colors"
                          title="Delete Student"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="w-full max-w-[540px] rounded-[24px] border border-border bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up-fast">
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-br from-primary/10 to-accent/5 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold">Add New Student</h3>
                <p className="text-[0.78rem] text-muted-foreground">Insert student credentials and profile fields</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-warn">✕</button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Register Number *</label>
                  <input type="text" required value={formReg} onChange={e => setFormReg(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Academic Year / Class *</label>
                  <select value={formClass} onChange={e => setFormClass(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none">
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Department *</label>
                  <select value={formDept} onChange={e => setFormDept(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none">
                    <option>Information Technology</option>
                    <option>Computer Science and Engineering</option>
                    <option>Artificial Intelligence and Data Science</option>
                    <option>Electronics and Communication Engineering</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                  <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="student.name@company.com" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Phone Number *</label>
                  <input type="text" required value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+91 98765 00000" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Designation</label>
                  <input type="text" value={formDesign} onChange={e => setFormDesign(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Date of Joining</label>
                  <input type="date" value={formJoin} onChange={e => setFormJoin(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
              </div>

              {formError && <p className="text-warn text-[0.78rem]">{formError}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-border/50 pt-4 mt-6">
                <button type="button" onClick={() => setShowAddModal(false)} className="rounded-lg border border-border bg-surface px-4 py-2 text-[0.82rem]">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-gradient text-primary-foreground rounded-lg px-5 py-2 text-[0.82rem] font-bold">
                  {submitting ? "Saving..." : "Save Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="w-full max-w-[540px] rounded-[24px] border border-border bg-card shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-slide-up-fast">
            <div className="flex items-center justify-between border-b border-border/50 bg-gradient-to-br from-primary/10 to-accent/5 px-6 py-5">
              <div>
                <h3 className="font-display text-lg font-bold">Edit Student Profile</h3>
                <p className="text-[0.78rem] text-muted-foreground">Update profile details for {selectedStudent.name}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-warn">✕</button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Register Number *</label>
                  <input type="text" disabled value={formReg} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none opacity-60 cursor-not-allowed" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Academic Year / Class *</label>
                  <select value={formClass} onChange={e => setFormClass(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none">
                    <option>1st Year</option>
                    <option>2nd Year</option>
                    <option>3rd Year</option>
                    <option>4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Department *</label>
                  <select value={formDept} onChange={e => setFormDept(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none">
                    <option>Information Technology</option>
                    <option>Computer Science and Engineering</option>
                    <option>Artificial Intelligence and Data Science</option>
                    <option>Electronics and Communication Engineering</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Email Address *</label>
                  <input type="email" required value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Phone Number *</label>
                  <input type="text" required value={formPhone} onChange={e => setFormPhone(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Designation</label>
                  <input type="text" value={formDesign} onChange={e => setFormDesign(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">Date of Joining</label>
                  <input type="date" value={formJoin} onChange={e => setFormJoin(e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-[0.82rem] outline-none" />
                </div>
              </div>

              {formError && <p className="text-warn text-[0.78rem]">{formError}</p>}

              <div className="flex items-center justify-end gap-3 border-t border-border/50 pt-4 mt-6">
                <button type="button" onClick={() => setShowEditModal(false)} className="rounded-lg border border-border bg-surface px-4 py-2 text-[0.82rem]">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-gradient text-primary-foreground rounded-lg px-5 py-2 text-[0.82rem] font-bold">
                  {submitting ? "Updating..." : "Update Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`animate-slide-up-fast fixed bottom-8 right-8 z-[999] rounded-lg border bg-card px-5 py-3.5 text-[0.88rem] shadow-[0_16px_40px_rgba(0,0,0,.3)] flex items-center gap-2 ${toast.success ? "border-present text-present" : "border-warn text-warn"}`}>
          {toast.success ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default AdminStudents;
