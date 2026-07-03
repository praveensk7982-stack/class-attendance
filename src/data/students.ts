export interface Student {
  id: number;
  name: string;
  reg: string;
  dept: string;
  designation?: string;
  email?: string;
  phone?: string;
  joiningDate?: string;
  joining_date?: string;
  photo?: string;
  photo_url?: string;
}

const thirdYearIT: { reg: string; name: string }[] = [
  { reg: "961223205001", name: "ABINAYA A" },
  { reg: "961223205002", name: "AGNEL IGNATIUS R" },
  { reg: "961223205003", name: "AKSHAYA R" },
  { reg: "961223205004", name: "AMAL SUNO E" },
  { reg: "961223205006", name: "ANSI ROSEMI M" },
  { reg: "961223205007", name: "ARA VINDHU S" },
  { reg: "961223205008", name: "ATCHAYA C" },
  { reg: "961223205009", name: "BAVANESH S" },
  { reg: "961223205010", name: "BHARATH PANDI R" },
  { reg: "961223205011", name: "CHERINA T" },
  { reg: "961223205012", name: "ESAKKIMUTHU S" },
  { reg: "961223205013", name: "G KESAVAN MOORTHY" },
  { reg: "961223205014", name: "GOLDA P" },
  { reg: "961223205015", name: "HARISH M" },
  { reg: "961223205016", name: "INDHU NANTHAKUMAR S" },
  { reg: "961223205017", name: "JAYA DANIEL J" },
  { reg: "961223205019", name: "JEBERSON N" },
  { reg: "961223205020", name: "JERSHIEL JACOB R" },
  { reg: "961223205021", name: "JULIYA A" },
  { reg: "961223205022", name: "KIRUTHIKA J" },
  { reg: "961223205023", name: "E KURTALLA RAJ E" },
  { reg: "961223205024", name: "L JEBA SHEELA" },
  { reg: "961223205025", name: "MADHUMITHA V" },
  { reg: "961223205026", name: "MAHAKAVI S" },
  { reg: "961223205027", name: "MANIKANDAN M" },
  { reg: "961223205028", name: "M VENKATESH" },
  { reg: "961223205029", name: "NANTHA KUMAR T" },
  { reg: "961223205030", name: "NETHAN S" },
  { reg: "961223205032", name: "PARTHIBAN S" },
  { reg: "961223205033", name: "PAUL ANTONI RAJ L" },
  { reg: "961223205034", name: "PONMUTHUPRAVIN K" },
  { reg: "961223205035", name: "PRAKASH DAVIDSON D" },
  { reg: "961223205036", name: "PRAVEEN R" },
  { reg: "961223205037", name: "PREETHI R" },
  { reg: "961223205038", name: "PRIYADHARSHINI G" },
  { reg: "961223205039", name: "SANTHOSH K J" },
  { reg: "961223205040", name: "SANTHOSH S" },
  { reg: "961223205041", name: "S CATHERINE KIRUBA VARANI" },
  { reg: "961223205042", name: "SELVA EASWARAN M" },
  { reg: "961223205043", name: "SHALOMI C" },
  { reg: "961223205044", name: "SHERIFA A J B" },
  { reg: "961223205045", name: "S PRAVEEN" },
  { reg: "961223205046", name: "SREE VIGNESH R" },
  { reg: "961223205048", name: "SUVIN M" },
  { reg: "961223205049", name: "THANALEKSHMI S" },
  { reg: "961223205050", name: "THANGA ANITHA R" },
  { reg: "961223205051", name: "THANISH T" },
  { reg: "961223205052", name: "THARSHINI R" },
  { reg: "961223205053", name: "THINU P" },
  { reg: "961223205054", name: "VIGNESHWARI L B" },
  { reg: "961223205055", name: "VINOTH V" },
  { reg: "961223205056", name: "VINOTHINI M" },
  { reg: "961223205057", name: "WILBIN DOMI M" },
  { reg: "961223205301", name: "BAGAVATHI PERUMAL G" },
  { reg: "961223205303", name: "TAMIL SELVAN S" },
  { reg: "961223205304", name: "VINOTH KUMAR P" },
];

const secondYearIT: { reg: string; name: string }[] = [
  { reg: "961224205001", name: "ABISHEK C" },
  { reg: "961224205002", name: "AKSHAYA K R" },
  { reg: "961224205003", name: "AMARNATH A" },
  { reg: "961224205004", name: "ANUSUYA M" },
  { reg: "961224205005", name: "AROCKIA AKSHAYA C" },
  { reg: "961224205006", name: "ASHA K" },
  { reg: "961224205007", name: "ASWIN A" },
  { reg: "961224205008", name: "BEJOSLIN R" },
  { reg: "961224205009", name: "BENSON JOSEPH D" },
  { reg: "961224205010", name: "BUVANA K" },
  { reg: "961224205011", name: "ESWARY M S" },
  { reg: "961224205012", name: "GEORGE JERONIUSE J" },
  { reg: "961224205013", name: "JUNIYA A" },
  { reg: "961224205014", name: "KAJILTHA R" },
  { reg: "961224205015", name: "MADHAVAN C" },
  { reg: "961224205016", name: "MANISH M" },
  { reg: "961224205017", name: "MUTHU KUMAR V" },
  { reg: "961224205018", name: "MUTHUVINISHA B" },
  { reg: "961224205020", name: "NAREN M" },
  { reg: "961224205022", name: "PASUPATHI E" },
  { reg: "961224205023", name: "RAJA A" },
  { reg: "961224205024", name: "RAJITHA A R" },
  { reg: "961224205025", name: "SANTHOSHKUMAR M" },
  { reg: "961224205026", name: "SHAM C" },
  { reg: "961224205027", name: "SHANE EBINESH S" },
  { reg: "961224205028", name: "SHARMITHA S" },
  { reg: "961224205029", name: "SHIJIN S" },
  { reg: "961224205030", name: "SRIRAM R" },
  { reg: "961224205031", name: "STELLA" },
  { reg: "961224205032", name: "VARSHA G" },
  { reg: "961224205033", name: "VARSHA K" },
  { reg: "961224205034", name: "VIJAYA RAHUL S M" },
  { reg: "961224205035", name: "WILSON JOSHUA M" },
  { reg: "961224205701", name: "LIPHIN AKSHAY" },
  { reg: "961224205301", name: "ABISHEK F" },
  { reg: "961224205302", name: "ARAVIND D" },
  { reg: "961224205306", name: "YOGESH T" },
];

// Random names pool for other departments
const randomNames = [
  "ARUN KUMAR S", "DEEPIKA R", "KARTHIK M", "LAVANYA P", "MOHAN RAJ K",
  "NITHYA S", "PRADEEP V", "RAMYA B", "SURESH T", "VIMAL R",
  "ANITHA D", "DINESH K", "GANESH R", "HEMALATHA S", "JANANI M",
  "KAVITHA L", "LOGESH P", "MEENA K", "NAVEEN S", "OVIYA R",
  "PAVITHRA M", "RANJITH K", "SARANYA V", "TAMILSELVI S", "UDHAYA K",
  "VENKATESH P", "YOGALAKSHMI S", "ASHWIN R", "BHARATHI M", "CHANDRU S",
  "DIVYA K", "ELAVARASAN P", "FAITH MARY J", "GOKUL S", "HARI KRISHNAN R",
  "ISWARYA M", "JAGAN K", "KEERTHANA S", "LAKSHMI PRIYA R", "MUKESH V",
  "NANDHINI T", "PRABHU S", "REVATHI K", "SAKTHIVEL M", "THENMOZHI R",
  "UMADEVI S", "VIJAY KUMAR R", "WINSON J", "XAVIER P", "YUVARAJ S",
];

const deptCodes: Record<string, string> = {
  "Artificial Intelligence and Data Science": "AD",
  "Mechanical Engineering": "ME",
  "Computer Science and Engineering": "CS",
  "Electrical and Electronics Engineering": "EE",
  "Electronics and Communication Engineering": "EC",
  "Artificial Intelligence and Machine Learning": "AM",
};

// Seeded random using dept+year as key for consistency
function seededShuffle(arr: string[], seed: string): string[] {
  const copy = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  for (let i = copy.length - 1; i > 0; i--) {
    h = (h * 16807 + 1) | 0;
    const j = Math.abs(h) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function generateDeptStudents(dept: string, yearKey: string): { reg: string; name: string }[] {
  const code = deptCodes[dept] || "XX";
  const yearNum = yearKey.replace(/\D/g, "");
  const seed = `${dept}-${yearKey}`;
  const shuffled = seededShuffle(randomNames, seed);
  const count = 10 + (Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 3); // 10-12
  return shuffled.slice(0, count).map((name, i) => ({
    reg: `9612${24 - Number(yearNum) + 1}${code}${String(i + 1).padStart(3, "0")}`,
    name,
  }));
}

export function getStudentsByYear(yearKey: string, dept: string = "Information Technology"): Student[] {
  let raw: { reg: string; name: string }[];

  if (dept === "Information Technology") {
    if (yearKey === "3rd Year") raw = thirdYearIT;
    else if (yearKey === "2nd Year") raw = secondYearIT;
    else raw = generateDeptStudents(dept, yearKey);
  } else {
    raw = generateDeptStudents(dept, yearKey);
  }

  const designations = [
    "Software Engineer",
    "QA Engineer",
    "UI/UX Designer",
    "Product Manager",
    "DevOps Engineer",
    "Data Analyst",
    "Systems Engineer",
    "Solution Architect",
    "Technical Lead",
    "HR Specialist"
  ];

  return raw.map((s, i) => {
    const nameSlug = s.name.toLowerCase().replace(/[^a-z]/g, "");
    const email = `${nameSlug.split("").slice(0, 8).join("")}.${s.reg.slice(-3)}@company.com`;
    const phone = `+91 98765 ${String(10000 + i + parseInt(s.reg.slice(-3) || "0")).slice(-5)}`;
    
    let joiningDate = "2024-06-15";
    if (yearKey === "4th Year") joiningDate = "2022-06-15";
    else if (yearKey === "3rd Year") joiningDate = "2023-06-15";
    else if (yearKey === "2nd Year") joiningDate = "2024-06-15";
    else if (yearKey === "1st Year") joiningDate = "2025-06-15";

    const designIndex = (i + s.name.charCodeAt(0)) % designations.length;
    const designation = designations[designIndex];
    const photo = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(s.name)}`;

    return {
      id: i + 1,
      name: s.name,
      reg: s.reg,
      dept,
      designation,
      email,
      phone,
      joiningDate,
      joining_date: joiningDate,
      photo,
      photo_url: photo,
    };
  });
}

export function mergeDbProfiles(localStudents: Student[], dbStudents: any[]): Student[] {
  return localStudents.map(local => {
    const dbMatch = dbStudents.find(
      db => db.register_number?.toLowerCase() === local.reg?.toLowerCase()
    );
    if (!dbMatch) return local;

    return {
      ...local,
      designation: dbMatch.designation || local.designation,
      email: dbMatch.email || local.email,
      phone: dbMatch.phone || local.phone,
      joiningDate: dbMatch.joining_date || local.joiningDate,
      joining_date: dbMatch.joining_date || local.joining_date,
      photo: dbMatch.photo_url || local.photo,
      photo_url: dbMatch.photo_url || local.photo_url,
    };
  });
}

// Default export for backward compat
export const students: Student[] = getStudentsByYear("3rd Year", "Information Technology");

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export type AttendanceRecord = Record<number, Record<string, 'present' | 'absent' | 'leave'>>;

export function seedAttendance(yearKey: string = "3rd Year", dept: string = "Information Technology"): AttendanceRecord {
  const today = new Date();
  const yearStudents = getStudentsByYear(yearKey, dept);
  const attendance: AttendanceRecord = {};
  yearStudents.forEach(s => {
    attendance[s.id] = {};
    for (let mo = 0; mo < 12; mo++) {
      const yr = today.getFullYear();
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      const limit = mo === today.getMonth() ? today.getDate() - 1 : daysInMonth;
      for (let d = 1; d <= limit; d++) {
        const dd = new Date(yr, mo, d);
        if (dd.getDay() === 0) continue;
        attendance[s.id][dd.toLocaleDateString('en-GB')] = Math.random() > 0.15 ? 'present' : 'absent';
      }
    }
  });
  return attendance;
}

export function countWorkingDays(mo: number): number {
  const yr = new Date().getFullYear();
  const days = new Date(yr, mo + 1, 0).getDate();
  let c = 0;
  for (let d = 1; d <= days; d++) {
    if (new Date(yr, mo, d).getDay() !== 0) c++;
  }
  return c;
}

export function getMonthlyStats(attendance: AttendanceRecord, sid: number, mo: number) {
  const rec = attendance[sid] || {};
  const yr = new Date().getFullYear();
  const days = new Date(yr, mo + 1, 0).getDate();
  let present = 0, absent = 0, leave = 0;
  for (let d = 1; d <= days; d++) {
    const key = new Date(yr, mo, d).toLocaleDateString('en-GB');
    if (rec[key] === 'present') present++;
    else if (rec[key] === 'absent') absent++;
    else if (rec[key] === 'leave') leave++;
  }
  return { present, absent, leave };
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2);
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  student_name?: string;
  register_number?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
}

export interface FineSettings {
  late_fine_rate: number;
  leave_fine_rate: number;
}

export interface StudentFine {
  id: string;
  student_id: string;
  student_name?: string;
  register_number?: string;
  month: number;
  year: number;
  late_fine_paid: boolean;
  leave_fine_paid: boolean;
  payment_status: 'Unpaid' | 'Paid';
}
