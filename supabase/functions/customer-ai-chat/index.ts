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

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages, language = 'ar' } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch published knowledge base articles for context
    const { data: articles } = await sb
      .from("knowledge_base_articles")
      .select("title, content, category, tags")
      .eq("is_published", true)
      .order("helpful_count", { ascending: false })
      .limit(30);

    const { data: services } = await sb
      .from("services")
      .select("name, description, systems(name)")
      .eq("is_active", true)
      .limit(20);

    const isArabic = language === 'ar';

    const kbContext = (articles || []).map((a: any, i: number) =>
      `[${isArabic ? 'مقال' : 'Article'} ${i + 1}] ${a.title}\n${isArabic ? 'التصنيف' : 'Category'}: ${a.category}\n${a.content.slice(0, 500)}`
    ).join("\n---\n");

    const servicesContext = (services || []).map((s: any) =>
      `- ${s.name}: ${s.description || ""} (${(s as any).systems?.name || ""})`
    ).join("\n");

    const systemPrompt = isArabic
      ? `أنت المساعد الذكي لنظام الدعم الفني. مهمتك:
1. الإجابة على استفسارات العملاء بدقة واحترافية
2. البحث في قاعدة المعرفة المتاحة لتقديم حلول
3. إذا لم تجد إجابة مناسبة، اقترح على العميل فتح تذكرة جديدة
4. كن ودوداً ومختصراً واستخدم العربية دائماً
5. قدم خطوات واضحة ومرقمة عند الحاجة
6. لا تخترع معلومات — التزم بما في قاعدة المعرفة

قاعدة المعرفة المتاحة:
${kbContext || "لا توجد مقالات حالياً"}

الخدمات المتاحة:
${servicesContext || "لا توجد خدمات"}

إذا لم تجد إجابة في قاعدة المعرفة، قل للعميل:
"لم أتمكن من إيجاد حل مباشر لمشكلتك. أنصحك بإنشاء تذكرة جديدة عبر قائمة 'تذكرة جديدة' وسيتم متابعتها من قبل فريق الدعم."`
      : `You are the smart assistant for the technical support system. Your tasks:
1. Answer customer inquiries accurately and professionally
2. Search the available knowledge base to provide solutions
3. If no suitable answer is found, suggest the customer create a new ticket
4. Be friendly and concise, always respond in English
5. Provide clear numbered steps when needed
6. Do not make up information — stick to what's in the knowledge base

Available Knowledge Base:
${kbContext || "No articles available"}

Available Services:
${servicesContext || "No services available"}

If you cannot find an answer in the knowledge base, tell the customer:
"I couldn't find a direct solution for your issue. I recommend creating a new ticket via the 'New Ticket' menu and our support team will follow up."`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، حاول لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "يلزم إضافة رصيد للاستمرار" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("customer-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
