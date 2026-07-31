// Outbound dispatcher: sends an event from our system to an external integration
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev";

function sanitize(s: string) {
  return (s || "").replace(/<[^>]*>/g, "").slice(0, 4000);
}

async function dispatchToSlack(connection: any, event: any) {
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!SLACK_API_KEY || !LOVABLE_API_KEY) {
    throw new Error("Slack connector not configured");
  }
  const channel = connection.config?.default_channel || "#general";
  const title = sanitize(event.payload?.title || event.event_type);
  const desc = sanitize(event.payload?.description || "");
  const ticketCode = event.payload?.code || event.payload?.ticket_number || "";
  const text = `*${title}*\n${desc}${ticketCode ? `\n\n_Ticket: ${ticketCode}_` : ""}`;

  const res = await fetch(`${GATEWAY}/slack/api/chat.postMessage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text, mrkdwn: true }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(`Slack failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return { http_status: res.status, response: data };
}

async function dispatchToTeams(connection: any, event: any) {
  const TEAMS_API_KEY = Deno.env.get("MICROSOFT_TEAMS_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!TEAMS_API_KEY || !LOVABLE_API_KEY) {
    throw new Error("Teams connector not configured");
  }
  const teamId = connection.config?.team_id;
  const channelId = connection.config?.channel_id;
  if (!teamId || !channelId) throw new Error("Teams team_id and channel_id required in config");

  const title = sanitize(event.payload?.title || event.event_type);
  const desc = sanitize(event.payload?.description || "");
  const html = `<b>${title}</b><br/>${desc}`;

  const res = await fetch(
    `${GATEWAY}/microsoft_teams/teams/${teamId}/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TEAMS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: { contentType: "html", content: html } }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Teams failed [${res.status}]: ${JSON.stringify(data)}`);
  return { http_status: res.status, response: data };
}

async function dispatchToJira(connection: any, event: any) {
  // Generic Jira via stored API token + base_url + email in credentials
  const baseUrl = connection.config?.base_url;
  const projectKey = connection.config?.project_key;
  const email = connection.credentials?.email;
  const apiToken = connection.credentials?.api_token;
  if (!baseUrl || !projectKey || !email || !apiToken) {
    throw new Error("Jira requires base_url, project_key, email, api_token");
  }
  const auth = btoa(`${email}:${apiToken}`);
  const summary = sanitize(event.payload?.title || "Ticket");
  const description = sanitize(event.payload?.description || "");

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: projectKey },
        summary,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
        },
        issuetype: { name: "Task" },
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Jira failed [${res.status}]: ${JSON.stringify(data)}`);
  return { http_status: res.status, response: data };
}

async function dispatchByProvider(supabase: any, connection: any, event: any) {
  const { data: provider } = await supabase
    .from("integration_providers")
    .select("code")
    .eq("id", connection.provider_id)
    .single();
  switch (provider?.code) {
    case "slack": return await dispatchToSlack(connection, event);
    case "microsoft_teams": return await dispatchToTeams(connection, event);
    case "jira": return await dispatchToJira(connection, event);
    default: throw new Error(`Unsupported provider: ${provider?.code}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { connection_id, event_type, entity_type, entity_id, payload, test_mode } =
      await req.json();

    if (!connection_id || !event_type) {
      return new Response(JSON.stringify({ error: "connection_id and event_type required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: connection, error: connErr } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("id", connection_id)
      .single();
    if (connErr || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!connection.is_active && !test_mode) {
      return new Response(JSON.stringify({ error: "Connection is inactive" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const start = Date.now();
    let logRow: any = {
      connection_id,
      direction: "outbound",
      event_type,
      entity_type: entity_type || null,
      entity_id: entity_id || null,
      request_payload: payload || {},
      status: "pending",
    };

    try {
      const result = await dispatchByProvider(supabase, connection, {
        event_type, payload: payload || {},
      });
      logRow = {
        ...logRow,
        status: "success",
        http_status: result.http_status,
        response_payload: result.response,
        duration_ms: Date.now() - start,
      };
      await supabase.from("integration_sync_logs").insert(logRow);
      await supabase
        .from("integration_connections")
        .update({
          last_sync_at: new Date().toISOString(),
          status: "connected",
          total_synced: (connection.total_synced || 0) + 1,
          last_error_message: null,
        })
        .eq("id", connection_id);

      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      logRow = { ...logRow, status: "failed", error_message: msg, duration_ms: Date.now() - start };
      await supabase.from("integration_sync_logs").insert(logRow);
      await supabase
        .from("integration_connections")
        .update({
          last_error_at: new Date().toISOString(),
          last_error_message: msg,
          total_failed: (connection.total_failed || 0) + 1,
          status: "error",
        })
        .eq("id", connection_id);

      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e: any) {
    console.error("integrations-dispatch error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
