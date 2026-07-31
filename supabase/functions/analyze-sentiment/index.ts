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

    const { title, description, comments } = await req.json();
    if (!title && !description) {
      return new Response(JSON.stringify({ sentiment: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const commentsText = (comments || []).map((c: string) => c).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `أنت محلل مشاعر متخصص لنظام تذاكر الدعم الفني. حلل مشاعر العميل بناءً على نص التذكرة والتعليقات.
حدد:
1. المشاعر العامة (positive, neutral, negative, frustrated, urgent)
2. مستوى الرضا (1-5)
3. هل يحتاج تدخل عاجل من مدير؟

أجب فقط باستخدام tool call.`
          },
          {
            role: "user",
            content: `العنوان: ${title || ""}\nالوصف: ${description || ""}\n${commentsText ? `التعليقات:\n${commentsText}` : ""}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_sentiment",
            description: "Analyze customer sentiment from ticket text",
            parameters: {
              type: "object",
              properties: {
                sentiment: { type: "string", enum: ["positive", "neutral", "negative", "frustrated", "urgent"] },
                satisfaction_score: { type: "number", description: "1-5 satisfaction score" },
                needs_escalation: { type: "boolean", description: "Whether manager intervention is needed" },
                summary: { type: "string", description: "Brief Arabic explanation of sentiment" },
                key_emotions: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of detected emotions in Arabic"
                }
              },
              required: ["sentiment", "satisfaction_score", "needs_escalation", "summary", "key_emotions"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_sentiment" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ sentiment: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const sentiment = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ sentiment }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ sentiment: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("analyze-sentiment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
