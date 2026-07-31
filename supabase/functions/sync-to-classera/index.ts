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

    const { ticket_id, status, resolution_summary, event_type } = await req.json();

    if (!ticket_id) {
      return new Response(JSON.stringify({ error: "ticket_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket with source system info
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, ticket_number, code, status, priority, source_system, external_reference, external_payload, service_id")
      .eq("id", ticket_id)
      .single();

    if (ticketErr || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only sync tickets that came from external systems (not PORTAL)
    if (ticket.source_system === "PORTAL") {
      return new Response(JSON.stringify({ success: true, message: "Portal ticket, no sync needed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get integration config for this module
    const { data: config } = await supabase
      .from("integration_configs")
      .select("*")
      .eq("module_code", ticket.source_system)
      .single();

    if (!config || !config.is_active || !config.api_endpoint) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: `Module ${ticket.source_system} not configured for outbound sync` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only sync if direction supports outbound
    if (config.sync_direction === "inbound") {
      return new Response(JSON.stringify({ success: true, message: "Inbound only, skipping" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build sync payload
    const syncPayload = {
      event_type: event_type || "status_changed",
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      ticket_code: ticket.code,
      status: status || ticket.status,
      priority: ticket.priority,
      external_reference: ticket.external_reference,
      resolution_summary: resolution_summary || null,
      timestamp: new Date().toISOString(),
    };

    // Send to Classera module callback URL
    const externalApiKey = Deno.env.get("EXTERNAL_API_KEY");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (externalApiKey) {
      headers["x-api-key"] = externalApiKey;
    }

    const response = await fetch(config.api_endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(syncPayload),
    });

    const responseText = await response.text();
    const syncSuccess = response.ok;

    // Update integration config with sync result
    await supabase
      .from("integration_configs")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: syncSuccess ? "success" : "error",
        error_message: syncSuccess ? null : `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
        tickets_synced_back: (config.tickets_synced_back || 0) + (syncSuccess ? 1 : 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    return new Response(JSON.stringify({ 
      success: syncSuccess, 
      module: ticket.source_system,
      response_status: response.status,
    }), {
      status: syncSuccess ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("sync-to-classera error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
