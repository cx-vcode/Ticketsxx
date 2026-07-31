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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { ticketId } = await req.json();
    if (!ticketId) throw new Error("ticketId is required");

    // Fetch ticket details
    const { data: ticket } = await sb
      .from("tickets")
      .select("title, description, priority, status, services(name, systems(name))")
      .eq("id", ticketId)
      .single();

    if (!ticket) throw new Error("Ticket not found");

    // Fetch recent comments
    const { data: comments } = await sb
      .from("ticket_comments")
      .select("content, note_type, created_at")
      .eq("ticket_id", ticketId)
      .eq("note_type", "public")
      .order("created_at", { ascending: true })
      .limit(15);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const ticketContext = `
التذكرة: ${ticket.title}
الوصف: ${ticket.description}
الحالة: ${ticket.status}
الأولوية: ${ticket.priority}
النظام: ${(ticket as any).services?.systems?.name || "غير محدد"}
الخدمة: ${(ticket as any).services?.name || "غير محدد"}

التعليقات:
${(comments || []).map((c: any) => c.content).join("\n---\n")}
`;

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
            content: `أنت مساعد لفريق الدعم الفني. مهمتك اقتراح 3 ردود جاهزة مختلفة يمكن للوكيل استخدامها للرد على العميل.

قواعد:
- أجب دائماً بالعربية
- قدم 3 ردود مختلفة: رد مختصر، رد تفصيلي، رد يطلب معلومات إضافية
- كن مهنياً ولطيفاً
- أعد النتيجة كـ JSON array من 3 strings فقط بدون أي تنسيق إضافي`,
          },
          {
            role: "user",
            content: `اقترح 3 ردود لهذه التذكرة:\n${ticketContext}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_replies",
              description: "Return 3 suggested replies for the agent",
              parameters: {
                type: "object",
                properties: {
                  replies: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["replies"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI gateway error: " + response.status);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let replies: string[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        replies = parsed.replies || [];
      } catch {
        replies = [];
      }
    }

    return new Response(JSON.stringify({ replies }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
