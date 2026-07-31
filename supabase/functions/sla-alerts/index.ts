import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function validateCronAuth(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (authHeader === `Bearer ${serviceKey}`) return true;

  const apiKey = req.headers.get("x-api-key");
  const cronKey = Deno.env.get("CRON_API_KEY");
  if (cronKey && apiKey === cronKey) return true;

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!validateCronAuth(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const warningThreshold = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    // Find tickets approaching SLA first response deadline
    const { data: responseAtRisk, error: err1 } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, requester_id, assigned_agent_id, sla_first_response_due_at")
      .is("first_response_at", null)
      .not("sla_first_response_due_at", "is", null)
      .gt("sla_first_response_due_at", now.toISOString())
      .lte("sla_first_response_due_at", warningThreshold)
      .in("status", ["new", "open", "in_progress"]);

    if (err1) throw err1;

    // Find tickets approaching SLA resolution deadline
    const { data: resolutionAtRisk, error: err2 } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, requester_id, assigned_agent_id, sla_resolution_due_at")
      .is("resolved_at", null)
      .not("sla_resolution_due_at", "is", null)
      .gt("sla_resolution_due_at", now.toISOString())
      .lte("sla_resolution_due_at", warningThreshold)
      .in("status", ["new", "open", "in_progress", "waiting_on_customer"]);

    if (err2) throw err2;

    let notifiedCount = 0;

    async function notifyUser(
      userId: string,
      ticketId: string,
      titleAr: string,
      titleEn: string,
      messageAr: string,
      messageEn: string,
      ticketNumber: number,
      ticketTitle: string,
    ) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", userId)
        .eq("ticket_id", ticketId)
        .eq("type", "sla_warning")
        .gte("created_at", new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) return;

      await supabase.from("notifications").insert({
        user_id: userId,
        ticket_id: ticketId,
        title: titleAr,
        message: messageAr,
        type: "sla_warning",
        data: { title_ar: titleAr, title_en: titleEn, message_ar: messageAr, message_en: messageEn },
      });

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, preferred_language")
        .eq("id", userId)
        .single();

      if (profile?.email) {
        try {
          const details = profile.preferred_language === "en" ? messageEn : messageAr;
          await supabase.functions.invoke("send-email-notification", {
            body: {
              ticket_id: ticketId,
              event_type: "sla_warning",
              recipient_email: profile.email,
              recipient_name: profile.full_name,
              ticket_number: ticketNumber,
              ticket_title: ticketTitle,
              details,
            },
          });
        } catch (e) {
          console.error("Email failed:", e);
        }
      }

      notifiedCount++;
    }

    for (const ticket of responseAtRisk || []) {
      const msgAr = `⚠️ التذكرة #${ticket.ticket_number} على وشك تجاوز مهلة الاستجابة الأولى (SLA)`;
      const msgEn = `⚠️ Ticket #${ticket.ticket_number} is close to breaching the first response SLA`;
      const titleAr = "تنبيه SLA - استجابة أولى ⏰";
      const titleEn = "SLA alert — first response ⏰";

      if (ticket.assigned_agent_id) {
        await notifyUser(ticket.assigned_agent_id, ticket.id, titleAr, titleEn, msgAr, msgEn, ticket.ticket_number, ticket.title);
      }

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      for (const admin of admins || []) {
        if (admin.user_id !== ticket.assigned_agent_id) {
          await notifyUser(admin.user_id, ticket.id, titleAr, titleEn, msgAr, msgEn, ticket.ticket_number, ticket.title);
        }
      }
    }

    for (const ticket of resolutionAtRisk || []) {
      const msgAr = `⚠️ التذكرة #${ticket.ticket_number} على وشك تجاوز مهلة الحل (SLA)`;
      const msgEn = `⚠️ Ticket #${ticket.ticket_number} is close to breaching the resolution SLA`;
      const titleAr = "تنبيه SLA - مهلة الحل ⏰";
      const titleEn = "SLA alert — resolution ⏰";

      if (ticket.assigned_agent_id) {
        await notifyUser(ticket.assigned_agent_id, ticket.id, titleAr, titleEn, msgAr, msgEn, ticket.ticket_number, ticket.title);
      }

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      for (const admin of admins || []) {
        if (admin.user_id !== ticket.assigned_agent_id) {
          await notifyUser(admin.user_id, ticket.id, titleAr, titleEn, msgAr, msgEn, ticket.ticket_number, ticket.title);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        response_at_risk: responseAtRisk?.length || 0,
        resolution_at_risk: resolutionAtRisk?.length || 0,
        notifications_sent: notifiedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("SLA alerts error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
