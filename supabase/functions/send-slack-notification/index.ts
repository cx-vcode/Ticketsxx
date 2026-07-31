import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!SLACK_API_KEY) {
      throw new Error("SLACK_API_KEY is not configured. Please connect Slack from Lovable settings.");
    }

    const { channel, message, ticket } = await req.json();

    if (!channel || !message) {
      return new Response(JSON.stringify({ error: "Missing channel or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build rich Slack message with ticket info
    const blocks = [];
    
    if (ticket) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: `🎫 تذكرة #${ticket.ticket_number || ""}`, emoji: true },
      });
      blocks.push({
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*العنوان:*\n${ticket.title || "—"}` },
          { type: "mrkdwn", text: `*الأولوية:*\n${ticket.priority || "—"}` },
          { type: "mrkdwn", text: `*الحالة:*\n${ticket.status || "—"}` },
          { type: "mrkdwn", text: `*المصدر:*\n${ticket.source_system || "PORTAL"}` },
        ],
      });
      blocks.push({ type: "divider" });
    }

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: message },
    });

    const slackPayload: any = {
      channel,
      text: message,
      unfurl_links: false,
      blocks,
    };

    const response = await fetch(`${GATEWAY_URL}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackPayload),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(`Slack API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, ts: data.ts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Slack notification error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
