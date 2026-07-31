import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub;

    const { ticketId } = await req.json();
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Verify access
    const { data: roleData } = await sb.from("user_roles").select("role").eq("user_id", userId).single();
    if (!roleData || !["admin", "agent", "developer"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Access denied" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: ticket } = await sb
      .from("tickets")
      .select("title, description, priority, status, code, created_at, resolved_at, resolution_summary, services(name, systems(name)), departments(name)")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: comments } = await sb
      .from("ticket_comments")
      .select("content, created_at, note_type, author_id")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(50);

    const { data: auditLogs } = await sb
      .from("audit_logs")
      .select("action, old_value, new_value, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .limit(30);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `أنت مساعد ذكي لنظام تذاكر دعم فني. مهمتك إنشاء ملخص شامل ومختصر للتذكرة يشمل:
1. ملخص المشكلة
2. الإجراءات المتخذة
3. الحالة الحالية
4. التوصيات (إن وجدت)

اكتب الملخص باللغة العربية بشكل مهني ومختصر. أجب فقط باستخدام tool call.`
          },
          {
            role: "user",
            content: `معلومات التذكرة:
- الكود: ${ticket.code}
- العنوان: ${ticket.title}
- الوصف: ${ticket.description}
- الحالة: ${ticket.status}
- الأولوية: ${ticket.priority}
- النظام: ${(ticket as any).services?.systems?.name || "غير محدد"}
- الخدمة: ${(ticket as any).services?.name || "غير محدد"}
- تاريخ الإنشاء: ${ticket.created_at}
${ticket.resolution_summary ? `- ملخص الحل: ${ticket.resolution_summary}` : ""}

التعليقات (${(comments || []).length}):
${(comments || []).map((c: any) => `[${c.note_type}] ${c.content}`).join("\n")}

سجل التغييرات (${(auditLogs || []).length}):
${(auditLogs || []).map((l: any) => `${l.action}: ${l.old_value || ""} → ${l.new_value || ""}`).join("\n")}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "ticket_summary",
            description: "Generate a comprehensive ticket summary",
            parameters: {
              type: "object",
              properties: {
                problem_summary: { type: "string", description: "Brief summary of the problem in Arabic" },
                actions_taken: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of actions taken"
                },
                current_status: { type: "string", description: "Current status description in Arabic" },
                recommendations: {
                  type: "array",
                  items: { type: "string" },
                  description: "Recommendations if any"
                },
                resolution_time_assessment: { type: "string", description: "Assessment of resolution time" },
                complexity: { type: "string", enum: ["simple", "moderate", "complex"] }
              },
              required: ["problem_summary", "actions_taken", "current_status", "recommendations", "complexity"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "ticket_summary" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ summary: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const summary = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ summary: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("summarize-ticket error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
