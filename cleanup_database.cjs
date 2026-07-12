const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Read .env file manually
const envPath = path.join(__dirname, ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join("=").trim().replace(/^"|"$/g, "");
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    // 1. Fetch all students
    const { data: students, error: fetchErr } = await supabase
      .from("students")
      .select("*");

    if (fetchErr) throw fetchErr;

    console.log(`Fetched ${students.length} students from database.`);

    const toDeleteIds = [];
    const seenRegs = new Set();
    const seenNames = new Set();

    students.forEach(student => {
      const cls = String(student.class || "").toLowerCase();
      const reg = String(student.register_number || "").trim();
      const name = String(student.name || "").trim().toLowerCase();

      // Check if 1st Year or 4th Year
      const is1stOr4th = cls.includes("1st") || cls.includes("4th") || cls.includes("1 year") || cls.includes("4 year");

      if (is1stOr4th) {
        console.log(`Targeting 1st/4th Year student for deletion: ${student.name} (${student.register_number}) - Class: ${student.class}`);
        toDeleteIds.push(student.id);
        return;
      }

      // Check duplicates by register number
      if (reg && seenRegs.has(reg)) {
        console.log(`Targeting duplicate Register Number for deletion: ${student.name} (${student.register_number})`);
        toDeleteIds.push(student.id);
        return;
      }

      // Check duplicates by name
      if (name && seenNames.has(name)) {
        console.log(`Targeting duplicate Name for deletion: ${student.name} (${student.register_number})`);
        toDeleteIds.push(student.id);
        return;
      }

      // Mark as seen
      if (reg) seenRegs.add(reg);
      if (name) seenNames.add(name);
    });

    console.log(`Identified ${toDeleteIds.length} students to delete.`);

    if (toDeleteIds.length > 0) {
      // Supabase delete in batches or using in operator
      const { data: delData, error: delErr } = await supabase
        .from("students")
        .delete()
        .in("id", toDeleteIds)
        .select();

      if (delErr) throw delErr;
      console.log(`Successfully deleted ${delData ? delData.length : 0} students from database.`);
    } else {
      console.log("No matching students found to delete from database.");
    }
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
}

run();
