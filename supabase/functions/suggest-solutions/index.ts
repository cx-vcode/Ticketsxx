import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
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

    const { ticketId } = await req.json();
    if (!ticketId) throw new Error("ticketId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get current ticket
    const { data: ticket } = await sb
      .from("tickets")
      .select("title, description, priority, status, services(name), departments(name)")
      .eq("id", ticketId)
      .single();

    if (!ticket) throw new Error("Ticket not found");

    // Get similar resolved tickets
    const { data: similarTickets } = await sb
      .from("tickets")
      .select("title, description, resolution_summary, status")
      .in("status", ["resolved", "closed"])
      .not("resolution_summary", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get KB articles
    const { data: articles } = await sb
      .from("knowledge_base_articles")
      .select("title, content, category")
      .eq("is_published", true)
      .order("helpful_count", { ascending: false })
      .limit(15);

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
            content: `أنت مساعد ذكي للوكلاء في نظام دعم فني. بناءً على التذكرة الحالية، اقترح حلولاً من التذاكر المشابهة المحلولة ومقالات قاعدة المعرفة.

أجب باستخدام tool call فقط.

التذكرة الحالية:
- العنوان: ${ticket.title}
- الوصف: ${ticket.description}
- الأولوية: ${ticket.priority}
- الخدمة: ${(ticket as any).services?.name || "غير محدد"}
- القسم: ${(ticket as any).departments?.name || "غير محدد"}

تذاكر محلولة سابقة:
${(similarTickets || []).map((t: any, i: number) => `${i + 1}. [${t.title}] الحل: ${t.resolution_summary}`).join("\n")}

مقالات قاعدة المعرفة:
${(articles || []).map((a: any, i: number) => `${i + 1}. [${a.title}] ${a.content.slice(0, 300)}`).join("\n")}`
          },
          { role: "user", content: "اقترح حلولاً لهذه التذكرة" }
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest_solutions",
            description: "Suggest solutions for the ticket",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string", description: "Solution title in Arabic" },
                      description: { type: "string", description: "Solution steps in Arabic" },
                      source: { type: "string", enum: ["similar_ticket", "knowledge_base", "ai_generated"] },
                      confidence: { type: "string", enum: ["high", "medium", "low"] }
                    },
                    required: ["title", "description", "source", "confidence"],
                    additionalProperties: false
                  }
                }
              },
              required: ["suggestions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "suggest_solutions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-solutions error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
