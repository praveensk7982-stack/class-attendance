import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Meta webhook verification token - this must match the value you set
// as an environment variable when configuring the webhook in Meta App Dashboard
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ---------- 1. Meta webhook verification (GET) ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ---------- 2. Incoming button click (POST) ----------
  if (req.method === "POST") {
    try {
      const payload = await req.json();

      const entry = payload?.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      // The button payload sent when a quick reply button is tapped
      const buttonPayload: string | undefined = message?.button?.payload;

      if (!buttonPayload) {
        // Ignore other events like status updates, read receipts, etc.
        return new Response(JSON.stringify({ ignored: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Payload format: "requestId:approve" or "requestId:reject"
      const [requestId, action] = buttonPayload.split(":");

      if (!requestId || (action !== "approve" && action !== "reject")) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid payload format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      // Update leave_requests status
      const { error: updateError } = await supabase
        .from("leave_requests")
        .update({ status: newStatus })
        .eq("id", requestId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Insert an entry into leave_audit_logs
      const { error: logError } = await supabase.from("leave_audit_logs").insert({
        leave_request_id: requestId,
        action: newStatus,
        actor: "HOD (WhatsApp)",
      });

      if (logError) {
        // Status update already succeeded, so don't fail the whole request
        // just because the audit log insert failed
        console.error("Audit log insert failed:", logError.message);
      }

      return new Response(JSON.stringify({ success: true, requestId, newStatus }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});