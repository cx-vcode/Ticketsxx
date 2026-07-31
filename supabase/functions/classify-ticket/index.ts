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

    const { title, description } = await req.json();
    if (!title && !description) {
      return new Response(JSON.stringify({ classification: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch departments, services, categories
    const [{ data: departments }, { data: services }, { data: categories }] = await Promise.all([
      sb.from("departments").select("id, name, description"),
      sb.from("services").select("id, name, description, system_id, default_assignment_group").eq("is_active", true),
      sb.from("service_categories").select("id, name, service_id").eq("is_active", true),
    ]);

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
            content: `أنت مصنف ذكي لتذاكر الدعم الفني. بناءً على عنوان ووصف التذكرة، حدد:
1. القسم المناسب
2. الأولوية (low, medium, high, urgent)
3. الخدمة والتصنيف إن أمكن

الأقسام المتاحة:
${JSON.stringify(departments || [], null, 2)}

الخدمات المتاحة:
${JSON.stringify(services || [], null, 2)}

التصنيفات المتاحة:
${JSON.stringify(categories || [], null, 2)}

أجب فقط باستخدام tool call.`
          },
          {
            role: "user",
            content: `العنوان: ${title || ""}\nالوصف: ${description || ""}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_ticket",
            description: "Classify ticket by department, priority, service, and category",
            parameters: {
              type: "object",
              properties: {
                department_id: { type: "string", description: "Most relevant department ID" },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                service_id: { type: "string", description: "Most relevant service ID, or empty" },
                category_id: { type: "string", description: "Most relevant category ID, or empty" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                reason: { type: "string", description: "Brief Arabic explanation" }
              },
              required: ["department_id", "priority", "confidence", "reason"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_ticket" } },
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
      return new Response(JSON.stringify({ classification: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const classification = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ classification }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ classification: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("classify-ticket error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
