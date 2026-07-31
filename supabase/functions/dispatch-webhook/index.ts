import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event_type, ticket, target_webhook_id } = await req.json();

    if (!event_type || !ticket) {
      return new Response(JSON.stringify({ error: "Missing event_type or ticket" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get webhooks: either a single targeted one (ping/retry) or all active subscribed
    let webhooks: any[] | null = null;
    if (target_webhook_id) {
      const { data } = await supabase
        .from("webhook_endpoints")
        .select("*")
        .eq("id", target_webhook_id);
      webhooks = data;
    } else {
      const { data } = await supabase
        .from("webhook_endpoints")
        .select("*")
        .eq("is_active", true)
        .contains("events", [event_type]);
      webhooks = data;
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ dispatched: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.allSettled(
      webhooks.map(async (wh) => {
        const payload = {
          event: event_type,
          timestamp: new Date().toISOString(),
          data: ticket,
        };

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(wh.headers || {}),
        };

        // HMAC signature if secret is set
        if (wh.secret) {
          const encoder = new TextEncoder();
          const key = await crypto.subtle.importKey(
            "raw",
            encoder.encode(wh.secret),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const signature = await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(JSON.stringify(payload))
          );
          const hexSig = Array.from(new Uint8Array(signature))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          headers["X-Webhook-Signature"] = `sha256=${hexSig}`;
        }

        let response_status = 0;
        let response_body = "";
        let success = false;

        try {
          const res = await fetch(wh.url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
          });
          response_status = res.status;
          response_body = await res.text();
          success = res.ok;
        } catch (err) {
          response_body = err instanceof Error ? err.message : String(err);
        }

        // Log delivery
        await supabase.from("webhook_logs").insert({
          webhook_id: wh.id,
          event_type,
          payload,
          response_status,
          response_body: response_body.substring(0, 2000),
          success,
        });

        // Update endpoint stats
        if (success) {
          await supabase
            .from("webhook_endpoints")
            .update({ last_triggered_at: new Date().toISOString(), failure_count: 0 })
            .eq("id", wh.id);
        } else {
          await supabase
            .from("webhook_endpoints")
            .update({ failure_count: (wh.failure_count || 0) + 1 })
            .eq("id", wh.id);
        }

        return { webhook_id: wh.id, success };
      })
    );

    return new Response(
      JSON.stringify({ dispatched: webhooks.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook dispatch error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
