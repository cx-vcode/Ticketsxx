import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get ticket creation data for the last 90 days
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const { data: tickets } = await sb
      .from("tickets")
      .select("created_at, priority, status, service_id, services(name, systems(name))")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (!tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ forecast: [], insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate daily counts
    const dailyCounts: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const byDay: Record<number, number> = {}; // 0=Sun..6=Sat

    tickets.forEach((t: any) => {
      const day = t.created_at.slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      const svcName = t.services?.name || "غير محدد";
      byService[svcName] = (byService[svcName] || 0) + 1;
      const dow = new Date(t.created_at).getDay();
      byDay[dow] = (byDay[dow] || 0) + 1;
    });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const dailyEntries = Object.entries(dailyCounts).sort(([a], [b]) => a.localeCompare(b));
    const last30 = dailyEntries.slice(-30);
    const avgDaily = last30.reduce((s, [, v]) => s + v, 0) / Math.max(last30.length, 1);

    const prompt = `أنت محلل بيانات متخصص في تذاكر الدعم الفني. حلل البيانات التالية وقدم تنبؤات وتوصيات.

بيانات آخر 30 يوم (تاريخ: عدد التذاكر):
${last30.map(([d, c]) => `${d}: ${c}`).join("\n")}

متوسط يومي: ${avgDaily.toFixed(1)}
إجمالي 90 يوم: ${tickets.length}

توزيع الأولويات: ${JSON.stringify(byPriority)}
أكثر الخدمات طلباً: ${JSON.stringify(Object.entries(byService).sort(([,a],[,b]) => (b as number) - (a as number)).slice(0, 5))}
توزيع أيام الأسبوع (0=أحد): ${JSON.stringify(byDay)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "أنت محلل بيانات خبير. أجب بالعربية فقط." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_forecast",
              description: "Provide ticket volume forecast and insights",
              parameters: {
                type: "object",
                properties: {
                  forecast: {
                    type: "array",
                    description: "7-day forecast",
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        predicted_count: { type: "number" },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["date", "predicted_count", "confidence"],
                      additionalProperties: false,
                    },
                  },
                  insights: {
                    type: "array",
                    description: "Key insights and recommendations",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["trend", "warning", "recommendation"] },
                        title: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["type", "title", "description"],
                      additionalProperties: false,
                    },
                  },
                  peak_day: { type: "string", description: "Busiest day of the week in Arabic" },
                  trend_direction: { type: "string", enum: ["increasing", "decreasing", "stable"] },
                  weekly_average: { type: "number" },
                },
                required: ["forecast", "insights", "peak_day", "trend_direction", "weekly_average"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_forecast" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error("AI error: " + response.status);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let result = { forecast: [], insights: [], peak_day: "", trend_direction: "stable", weekly_average: 0 };

    if (toolCall?.function?.arguments) {
      try {
        result = JSON.parse(toolCall.function.arguments);
      } catch {}
    }

    // Add historical data
    return new Response(JSON.stringify({
      ...result,
      historical: last30.map(([date, count]) => ({ date, count })),
      total_90d: tickets.length,
      avg_daily: Math.round(avgDaily * 10) / 10,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forecast-tickets error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
