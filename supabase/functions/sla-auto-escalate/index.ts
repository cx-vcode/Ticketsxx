import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date().toISOString();

    const { data: breachedTickets, error: fetchErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, title, priority, status, assigned_agent_id, requester_id, department_id, sla_resolution_due_at")
      .not("status", "in", '("resolved","closed")')
      .lt("sla_resolution_due_at", now)
      .not("sla_resolution_due_at", "is", null);

    if (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: "Internal error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!breachedTickets || breachedTickets.length === 0) {
      return new Response(JSON.stringify({ escalated: 0, message: "No SLA breaches found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let escalatedCount = 0;

    for (const ticket of breachedTickets) {
      const newPriority = ticket.priority === "low" ? "medium" : 
                          ticket.priority === "medium" ? "high" : 
                          ticket.priority === "high" ? "urgent" : "urgent";

      if (newPriority !== ticket.priority) {
        await supabase
          .from("tickets")
          .update({ priority: newPriority, updated_at: now })
          .eq("id", ticket.id);
      }

      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins) {
        const notifications = admins.map((admin) => ({
          user_id: admin.user_id,
          ticket_id: ticket.id,
          title: "⚠️ تصعيد تلقائي - تجاوز SLA",
          message: `تم تصعيد التذكرة #${ticket.ticket_number} تلقائياً من ${ticket.priority} إلى ${newPriority} بسبب تجاوز مهلة SLA`,
          type: "sla_escalation",
        }));

        await supabase.from("notifications").insert(notifications);
      }

      if (ticket.assigned_agent_id) {
        await supabase.from("audit_logs").insert({
          ticket_id: ticket.id,
          user_id: ticket.assigned_agent_id,
          action: `تصعيد تلقائي SLA: ${ticket.priority} → ${newPriority}`,
          event_type: "priority_changed",
          old_value: ticket.priority,
          new_value: newPriority,
        });
      }

      escalatedCount++;
    }

    return new Response(JSON.stringify({ 
      escalated: escalatedCount, 
      total_breached: breachedTickets.length 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SLA auto-escalate error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
