import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UnpaidFineSummary {
  total: number;
  leaveAmount: number;
  intervalAmount: number;
  count: number;
}

const EMPTY: UnpaidFineSummary = { total: 0, leaveAmount: 0, intervalAmount: 0, count: 0 };

const isUuid = (val: any) =>
  typeof val === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Live total of this student's UNPAID fines (fine_entries). Updates when admin adds a fine.
export const useUnpaidFines = (student: any): UnpaidFineSummary => {
  const [summary, setSummary] = useState<UnpaidFineSummary>(EMPTY);

  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    let uuid: string | null = isUuid(student.id) ? student.id : null;

    const load = async () => {
      if (!uuid) {
        const regNo = student.register_number || student.reg || student.student_id;
        if (!regNo) return;
        const { data } = await supabase
          .from("students")
          .select("id")
          .eq("register_number", regNo)
          .maybeSingle();
        uuid = data?.id ?? null;
      }
      if (!uuid) return;

      const { data: rows, error } = await supabase
        .from("fine_entries")
        .select("type, amount")
        .eq("student_id", uuid)
        .eq("status", "Unpaid");
      if (error || cancelled) return;

      let leaveAmount = 0;
      let intervalAmount = 0;
      (rows ?? []).forEach((r: any) => {
        if (r.type === "Late") intervalAmount += Number(r.amount);
        else leaveAmount += Number(r.amount);
      });
      setSummary({
        total: leaveAmount + intervalAmount,
        leaveAmount,
        intervalAmount,
        count: rows?.length ?? 0
      });
    };

    load();

    const channel = supabase
      .channel(`unpaid-fines-${student.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fine_entries" }, () => {
        load();
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [student?.id]);

  return summary;
};