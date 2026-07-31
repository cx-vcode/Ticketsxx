import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { trigger_event, ticket } = await req.json();

    if (!trigger_event || !ticket) {
      return new Response(JSON.stringify({ error: "Missing trigger_event or ticket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get active rules for this trigger
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("trigger_event", trigger_event)
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ executed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const executed: string[] = [];

    for (const rule of rules) {
      // Evaluate conditions
      const conditions = rule.conditions as Array<{
        field: string;
        operator: string;
        value: string;
      }>;

      const conditionsMet = conditions.every((c) => {
        const ticketVal = String(ticket[c.field] || "").toLowerCase();
        const condVal = String(c.value).toLowerCase();

        switch (c.operator) {
          case "equals": return ticketVal === condVal;
          case "not_equals": return ticketVal !== condVal;
          case "contains": return ticketVal.includes(condVal);
          case "starts_with": return ticketVal.startsWith(condVal);
          default: return false;
        }
      });

      if (!conditionsMet) continue;

      // Execute actions
      const actions = rule.actions as Array<{
        type: string;
        [key: string]: string;
      }>;

      const actionsExecuted: Array<{ type: string; success: boolean; detail?: string }> = [];

      for (const action of actions) {
        try {
          switch (action.type) {
            case "change_priority":
              await supabase.from("tickets").update({ priority: action.value }).eq("id", ticket.id);
              actionsExecuted.push({ type: action.type, success: true, detail: action.value });
              break;

            case "change_status":
              await supabase.from("tickets").update({ status: action.value }).eq("id", ticket.id);
              actionsExecuted.push({ type: action.type, success: true, detail: action.value });
              break;

            case "assign_agent":
              await supabase.from("tickets").update({ assigned_agent_id: action.value }).eq("id", ticket.id);
              actionsExecuted.push({ type: action.type, success: true, detail: action.value });
              break;

            case "assign_department":
              await supabase.from("tickets").update({ department_id: action.value }).eq("id", ticket.id);
              actionsExecuted.push({ type: action.type, success: true, detail: action.value });
              break;

            case "send_email": {
              // Send email via edge function
              const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  ticket_id: ticket.id,
                  event_type: "automation",
                  recipient_email: action.recipient_email || ticket.requester_email,
                  recipient_name: action.recipient_name || "",
                  ticket_number: ticket.ticket_number,
                  ticket_title: ticket.title,
                  details: action.message || `تم تنفيذ إجراء تلقائي على التذكرة #${ticket.ticket_number}`,
                }),
              });
              const emailBody = await emailRes.text();
              actionsExecuted.push({ type: action.type, success: emailRes.ok, detail: emailBody });
              break;
            }

            case "send_notification": {
              const recipientId = action.recipient_id || ticket.requester_id;
              const titleAr = action.title || "إشعار تلقائي";
              const messageAr = action.message || `تم تنفيذ إجراء تلقائي على التذكرة #${ticket.ticket_number}`;
              const titleEn = action.title || "Automation notification";
              const messageEn = action.message || `An automated action was executed on ticket #${ticket.ticket_number}`;

              await supabase.from("notifications").insert({
                user_id: recipientId,
                ticket_id: ticket.id,
                title: titleAr,
                message: messageAr,
                type: "automation",
                data: {
                  title_ar: titleAr,
                  title_en: titleEn,
                  message_ar: messageAr,
                  message_en: messageEn,
                },
              });
              actionsExecuted.push({ type: action.type, success: true });
              break;
            }

            case "webhook": {
              // Trigger webhook dispatch
              const whRes = await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({ event_type: `automation.${rule.name}`, ticket }),
              });
              const whBody = await whRes.text();
              actionsExecuted.push({ type: action.type, success: whRes.ok, detail: whBody });
              break;
            }

            case "send_slack": {
              // Use dedicated Slack notification function
              const slackRes = await fetch(`${supabaseUrl}/functions/v1/send-slack-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  channel: action.channel || "#general",
                  message: action.message || `🎫 تذكرة #${ticket.ticket_number}: ${ticket.title}`,
                  ticket,
                }),
              });
              const slackBody = await slackRes.json();
              actionsExecuted.push({
                type: action.type,
                success: slackRes.ok && slackBody.success,
                detail: slackBody.success ? "sent" : slackBody.error,
              });
              break;
            }

            default:
              actionsExecuted.push({ type: action.type, success: false, detail: "Unknown action type" });
          }
        } catch (err) {
          actionsExecuted.push({ type: action.type, success: false, detail: err instanceof Error ? err.message : String(err) });
        }
      }

      // Log execution
      await supabase.from("automation_logs").insert({
        rule_id: rule.id,
        ticket_id: ticket.id,
        trigger_event,
        actions_executed: actionsExecuted,
        success: actionsExecuted.every((a) => a.success),
        error_message: actionsExecuted.filter((a) => !a.success).map((a) => a.detail).join("; ") || null,
      });

      // Update rule stats
      await supabase
        .from("automation_rules")
        .update({
          execution_count: (rule.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      executed.push(rule.id);
    }

    return new Response(JSON.stringify({ executed: executed.length, rule_ids: executed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Automation error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
