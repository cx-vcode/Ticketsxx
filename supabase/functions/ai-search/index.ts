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

    const { query, type = "search" } = await req.json();
    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    if (type === "search") {
      // AI-powered natural language search
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
              content: `أنت محرك بحث ذكي لنظام تذاكر الدعم الفني. حول استعلام المستخدم بلغة طبيعية إلى فلاتر بحث.
              
الحالات المتاحة: new, open, in_progress, waiting_on_customer, resolved, closed, reopened
الأولويات: low, medium, high, urgent

أمثلة:
"التذاكر المتأخرة" → فلتر SLA متأخر
"التذاكر العاجلة المفتوحة" → priority=urgent, status=open
"تذاكر أحمد" → بحث بالاسم

أعد الفلاتر فقط عبر tool call.`,
            },
            { role: "user", content: query },
          ],
          tools: [{
            type: "function",
            function: {
              name: "search_tickets",
              description: "Convert natural language to ticket search filters",
              parameters: {
                type: "object",
                properties: {
                  text_search: { type: "string", description: "Text to search in title/description" },
                  status: { type: "string", description: "Filter by status" },
                  priority: { type: "string", description: "Filter by priority" },
                  is_overdue: { type: "boolean", description: "Filter overdue tickets" },
                  agent_name: { type: "string", description: "Filter by agent name" },
                  requester_name: { type: "string", description: "Filter by requester name" },
                  interpretation: { type: "string", description: "Arabic explanation of the search" },
                },
                required: ["interpretation"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "search_tickets" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }

      const aiData = await response.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let filters: any = {};

      if (toolCall?.function?.arguments) {
        filters = JSON.parse(toolCall.function.arguments);
      }

      // Execute search with filters
      let ticketQuery = sb
        .from("tickets")
        .select("id, ticket_number, title, status, priority, created_at, sla_resolution_due_at, resolved_at, requester:profiles!tickets_requester_id_fkey(full_name), agent:profiles!tickets_assigned_agent_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (filters.status) ticketQuery = ticketQuery.eq("status", filters.status);
      if (filters.priority) ticketQuery = ticketQuery.eq("priority", filters.priority);
      if (filters.text_search) ticketQuery = ticketQuery.or(`title.ilike.%${filters.text_search}%,description.ilike.%${filters.text_search}%`);
      if (filters.is_overdue) {
        ticketQuery = ticketQuery
          .lt("sla_resolution_due_at", new Date().toISOString())
          .is("resolved_at", null);
      }

      const { data: tickets, error } = await ticketQuery;
      if (error) throw error;

      // Further filter by name if specified
      let results = tickets || [];
      if (filters.agent_name) {
        results = results.filter((t: any) => t.agent?.full_name?.includes(filters.agent_name));
      }
      if (filters.requester_name) {
        results = results.filter((t: any) => t.requester?.full_name?.includes(filters.requester_name));
      }

      return new Response(JSON.stringify({
        filters,
        interpretation: filters.interpretation,
        results,
        count: results.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-search error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
