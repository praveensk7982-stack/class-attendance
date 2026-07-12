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
  const { data } = await supabase.from("students").select("*");
  if (data) {
    console.log("Total students in database:", data.length);
    console.log("List of all students:");
    data.forEach(s => {
      console.log(`ID: ${s.id} | Class: ${s.class} | Reg: ${s.register_number} | Name: ${s.name}`);
    });
  }
}
run();
