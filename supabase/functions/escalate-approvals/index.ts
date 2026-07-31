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

    // Find overdue pending approvals that have a deadline and haven't been escalated
    const { data: overdueApprovals, error: fetchError } = await supabase
      .from("ticket_approvals")
      .select(
        "id, ticket_id, stage_id, deadline_at, approval_stages(stage_name, escalation_to)"
      )
      .eq("status", "pending")
      .eq("is_escalated", false)
      .not("deadline_at", "is", null)
      .lt("deadline_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    let escalatedCount = 0;

    for (const approval of overdueApprovals || []) {
      const stage = approval.approval_stages as any;
      const escalationTo = stage?.escalation_to;

      // Mark as escalated
      await supabase
        .from("ticket_approvals")
        .update({
          is_escalated: true,
          ...(escalationTo ? { delegated_to: escalationTo } : {}),
        })
        .eq("id", approval.id);

      // Get ticket info for notification
      const { data: ticket } = await supabase
        .from("tickets")
        .select("ticket_number, requester_id, title")
        .eq("id", approval.ticket_id)
        .single();

      // Notify escalation target (in-app + email)
      if (escalationTo && ticket) {
        await supabase.from("notifications").insert({
          user_id: escalationTo,
          ticket_id: approval.ticket_id,
          title: "تصعيد اعتماد ⚠️",
          message: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} إليك بسبب تأخر الاعتماد`,
          type: "approval_escalated",
          data: {
            title_ar: "تصعيد اعتماد ⚠️",
            title_en: "Approval escalation ⚠️",
            message_ar: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} إليك بسبب تأخر الاعتماد`,
            message_en: `Stage "${stage?.stage_name}" for ticket #${ticket.ticket_number} was escalated to you due to overdue approval.`,
          },
        });

        const { data: escalationProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", escalationTo)
          .single();

        if (escalationProfile?.email) {
          try {
            await supabase.functions.invoke("send-email-notification", {
              body: {
                ticket_id: approval.ticket_id,
                event_type: "approval_escalated",
                recipient_email: escalationProfile.email,
                recipient_name: escalationProfile.full_name,
                ticket_number: ticket.ticket_number,
                ticket_title: ticket.title,
                details: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} إليك بسبب تأخر الاعتماد. يرجى مراجعتها واتخاذ الإجراء المناسب.`,
              },
            });
          } catch (emailErr) {
            console.error("Failed to send escalation email:", emailErr);
          }
        }
      }

      // Notify requester
      if (ticket) {
        await supabase.from("notifications").insert({
          user_id: ticket.requester_id,
          ticket_id: approval.ticket_id,
          title: "تصعيد مرحلة اعتماد",
          message: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} بسبب تأخر الاعتماد`,
          type: "approval_escalated",
          data: {
            title_ar: "تصعيد مرحلة اعتماد",
            title_en: "Approval stage escalated",
            message_ar: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} بسبب تأخر الاعتماد`,
            message_en: `Stage "${stage?.stage_name}" for ticket #${ticket.ticket_number} was escalated due to overdue approval.`,
          },
        });

        const { data: requesterProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", ticket.requester_id)
          .single();

        if (requesterProfile?.email) {
          try {
            await supabase.functions.invoke("send-email-notification", {
              body: {
                ticket_id: approval.ticket_id,
                event_type: "approval_escalated",
                recipient_email: requesterProfile.email,
                recipient_name: requesterProfile.full_name,
                ticket_number: ticket.ticket_number,
                ticket_title: ticket.title,
                details: `تم تصعيد مرحلة "${stage?.stage_name}" للتذكرة #${ticket.ticket_number} بسبب تأخر الاعتماد.`,
              },
            });
          } catch (emailErr) {
            console.error("Failed to send requester email:", emailErr);
          }
        }
      }

      escalatedCount++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        escalated: escalatedCount,
        checked: overdueApprovals?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Escalation error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
