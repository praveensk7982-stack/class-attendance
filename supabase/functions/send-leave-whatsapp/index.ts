import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { requestId, employeeName, leaveType, fromDate, toDate, reason } = body;

    if (!requestId) {
      return new Response(
        JSON.stringify({ success: false, error: "requestId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const META_TOKEN = Deno.env.get("META_WHATSAPP_TOKEN");
    const PHONE_NUMBER_ID = Deno.env.get("META_PHONE_NUMBER_ID");
    const HOD_NUMBER = Deno.env.get("HOD_WHATSAPP_NUMBER");

    const response = await fetch(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${META_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: HOD_NUMBER,
          type: "template",
          template: {
            name: "leave_application_alert",
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: employeeName },
                  { type: "text", text: leaveType },
                  { type: "text", text: fromDate },
                  { type: "text", text: toDate },
                  { type: "text", text: reason },
                ],
              },
              {
                type: "button",
                sub_type: "quick_reply",
                index: "0",
                parameters: [
                  { type: "payload", payload: `${requestId}:approve` },
                ],
              },
              {
                type: "button",
                sub_type: "quick_reply",
                index: "1",
                parameters: [
                  { type: "payload", payload: `${requestId}:reject` },
                ],
              },
            ],
          },
        }),
      }
    );

    const result = await response.json();
    const statusCode = response.status;

    return new Response(JSON.stringify({ success: response.ok, statusCode, result }), {
      status: response.ok ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});