import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
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

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekStart = oneWeekAgo.toISOString();

    const { data: developers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "developer");

    if (!developers || developers.length === 0) {
      return new Response(JSON.stringify({ message: "No developers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reports = [];

    for (const dev of developers) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", dev.user_id)
        .single();

      if (!profile) continue;

      const { data: assignedTickets, count: totalAssigned } = await supabase
        .from("tickets")
        .select("id, status, priority, created_at, resolved_at", { count: "exact" })
        .eq("assigned_agent_id", dev.user_id)
        .gte("created_at", weekStart);

      const { count: resolvedCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact" })
        .eq("assigned_agent_id", dev.user_id)
        .not("resolved_at", "is", null)
        .gte("resolved_at", weekStart);

      const { count: openCount } = await supabase
        .from("tickets")
        .select("id", { count: "exact" })
        .eq("assigned_agent_id", dev.user_id)
        .in("status", ["new", "open", "in_progress"]);

      const { count: commentsCount } = await supabase
        .from("ticket_comments")
        .select("id", { count: "exact" })
        .eq("author_id", dev.user_id)
        .gte("created_at", weekStart);

      const priorityBreakdown = {
        urgent: assignedTickets?.filter(t => t.priority === "urgent").length || 0,
        high: assignedTickets?.filter(t => t.priority === "high").length || 0,
        medium: assignedTickets?.filter(t => t.priority === "medium").length || 0,
        low: assignedTickets?.filter(t => t.priority === "low").length || 0,
      };

      let avgResolutionHours = 0;
      const resolvedTickets = assignedTickets?.filter(t => t.resolved_at) || [];
      if (resolvedTickets.length > 0) {
        const totalHours = resolvedTickets.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime();
          const resolved = new Date(t.resolved_at!).getTime();
          return sum + (resolved - created) / (1000 * 60 * 60);
        }, 0);
        avgResolutionHours = Math.round(totalHours / resolvedTickets.length);
      }

      const reportSummaryAr = `📊 التقرير الأسبوعي - ${profile.full_name}
━━━━━━━━━━━━━━━━━━━━━━
📋 التذاكر الجديدة: ${totalAssigned || 0}
✅ التذاكر المحلولة: ${resolvedCount || 0}
📂 التذاكر المفتوحة: ${openCount || 0}
💬 التعليقات: ${commentsCount || 0}
⏱️ متوسط وقت الحل: ${avgResolutionHours} ساعة
━━━━━━━━━━━━━━━━━━━━━━
🔴 عاجل: ${priorityBreakdown.urgent} | 🟠 عالي: ${priorityBreakdown.high}
🟡 متوسط: ${priorityBreakdown.medium} | 🟢 منخفض: ${priorityBreakdown.low}`;

      const reportSummaryEn = `📊 Weekly report - ${profile.full_name}
━━━━━━━━━━━━━━━━━━━━━━
📋 New assigned tickets: ${totalAssigned || 0}
✅ Resolved tickets: ${resolvedCount || 0}
📂 Open tickets: ${openCount || 0}
💬 Comments: ${commentsCount || 0}
⏱️ Avg resolution time: ${avgResolutionHours}h
━━━━━━━━━━━━━━━━━━━━━━
🔴 Urgent: ${priorityBreakdown.urgent} | 🟠 High: ${priorityBreakdown.high}
🟡 Medium: ${priorityBreakdown.medium} | 🟢 Low: ${priorityBreakdown.low}`;

      await supabase.from("notifications").insert({
        user_id: dev.user_id,
        title: "📊 التقرير الأسبوعي",
        message: reportSummaryAr,
        type: "weekly_report",
        data: {
          title_ar: "📊 التقرير الأسبوعي",
          title_en: "📊 Weekly report",
          message_ar: reportSummaryAr,
          message_en: reportSummaryEn,
        },
      });

      reports.push({
        developer: profile.full_name,
        totalAssigned: totalAssigned || 0,
        resolved: resolvedCount || 0,
        open: openCount || 0,
        comments: commentsCount || 0,
        avgResolutionHours,
      });
    }

    return new Response(JSON.stringify({ success: true, reports }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Weekly report error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
