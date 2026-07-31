import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-module-code",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate API key
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("EXTERNAL_API_KEY");
    if (expectedKey && apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();
    const body = await req.json();

    // Route actions
    switch (action) {
      case "sync-ticket": {
        return await handleSyncTicket(supabase, body, corsHeaders);
      }
      case "update-status": {
        return await handleUpdateStatus(supabase, body, corsHeaders);
      }
      case "get-status": {
        return await handleGetStatus(supabase, body, corsHeaders);
      }
      case "health": {
        return new Response(JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          supported_modules: ["LMS", "ERP", "SIS", "CPAY", "EDUMALLS", "SMART_SCHOOL", "DASHBOARD", "HR", "PORTAL"]
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      default: {
        // Default: create ticket (backward compatible)
        return await handleCreateTicket(supabase, body, corsHeaders);
      }
    }
  } catch (error) {
    console.error("classera-webhook error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleCreateTicket(supabase: any, body: any, headers: Record<string, string>) {
  const { source_system, title, description, priority, requester_email, requester_name, external_reference, external_payload, service_name, category_name } = body;

  if (!source_system || !title || !description || !requester_email) {
    return new Response(JSON.stringify({
      error: "Missing required fields",
      required: ["source_system", "title", "description", "requester_email"],
    }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
  }

  const validSources = ["ERP", "LMS", "CPAY", "PORTAL", "SIS", "EDUMALLS", "SMART_SCHOOL", "DASHBOARD", "HR"];
  if (!validSources.includes(source_system)) {
    return new Response(JSON.stringify({
      error: `Invalid source_system. Must be one of: ${validSources.join(", ")}`,
    }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
  }

  // Check if module is active
  const { data: moduleConfig } = await supabase
    .from("integration_configs")
    .select("is_active")
    .eq("module_code", source_system)
    .single();

  if (moduleConfig && !moduleConfig.is_active) {
    return new Response(JSON.stringify({ error: `Module ${source_system} is not active` }), {
      status: 403,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // Find or create requester
  let { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", requester_email)
    .single();

  if (!profile) {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: requester_email,
      email_confirm: true,
      password: crypto.randomUUID(),
      user_metadata: { full_name: requester_name || requester_email.split("@")[0] },
    });

    if (authError && !authError.message.includes("already")) {
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    if (authUser?.user) {
      profile = { id: authUser.user.id };
    } else {
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", requester_email).single();
      profile = existing;
    }
  }

  if (!profile) {
    return new Response(JSON.stringify({ error: "Could not resolve requester" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  // Resolve service
  let service_id = null, category_id = null, department_id = null;
  if (service_name) {
    const { data: service } = await supabase.from("services").select("id, default_assignment_group").ilike("name", service_name).single();
    if (service) { service_id = service.id; department_id = service.default_assignment_group; }
  }
  if (category_name && service_id) {
    const { data: cat } = await supabase.from("service_categories").select("id").eq("service_id", service_id).ilike("name", category_name).single();
    if (cat) category_id = cat.id;
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("tickets")
    .insert({
      title, description, priority: priority || "medium",
      requester_id: profile.id, source_system,
      external_reference: external_reference || null,
      external_payload: external_payload || null,
      service_id, category_id, department_id,
    })
    .select("id, ticket_number, code, status, priority, created_at")
    .single();

  if (ticketError) throw ticketError;

  // Update integration stats
  await supabase.rpc("increment_integration_tickets", { _module_code: source_system }).catch(() => {
    // Fallback: direct update
    supabase.from("integration_configs")
      .update({ tickets_received: moduleConfig ? (moduleConfig.tickets_received || 0) + 1 : 1, last_sync_at: new Date().toISOString(), sync_status: "success" })
      .eq("module_code", source_system);
  });

  return new Response(JSON.stringify({ success: true, ticket }), {
    status: 201, headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function handleSyncTicket(supabase: any, body: any, headers: Record<string, string>) {
  const { ticket_id, external_reference, source_system, sync_data } = body;
  if (!ticket_id) {
    return new Response(JSON.stringify({ error: "ticket_id is required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const updates: Record<string, any> = {};
  if (external_reference) updates.external_reference = external_reference;
  if (sync_data) updates.external_payload = sync_data;

  const { data, error } = await supabase
    .from("tickets")
    .update(updates)
    .eq("id", ticket_id)
    .select("id, ticket_number, code, status")
    .single();

  if (error) throw error;

  return new Response(JSON.stringify({ success: true, ticket: data }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function handleUpdateStatus(supabase: any, body: any, headers: Record<string, string>) {
  const { ticket_id, external_reference, status, resolution_summary } = body;
  const filter = ticket_id ? { id: ticket_id } : external_reference ? { external_reference } : null;

  if (!filter) {
    return new Response(JSON.stringify({ error: "ticket_id or external_reference required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const validStatuses = ["new", "open", "in_progress", "waiting_on_customer", "resolved", "closed"];
  if (status && !validStatuses.includes(status)) {
    return new Response(JSON.stringify({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const updates: Record<string, any> = {};
  if (status) updates.status = status;
  if (resolution_summary) updates.resolution_summary = resolution_summary;
  if (status === "resolved") updates.resolved_at = new Date().toISOString();
  if (status === "closed") updates.closed_at = new Date().toISOString();

  let query = supabase.from("tickets").update(updates);
  if (filter.id) query = query.eq("id", filter.id);
  else query = query.eq("external_reference", filter.external_reference);

  const { data, error } = await query.select("id, ticket_number, code, status").single();
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, ticket: data }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

async function handleGetStatus(supabase: any, body: any, headers: Record<string, string>) {
  const { ticket_id, external_reference } = body;
  
  let query = supabase.from("tickets").select("id, ticket_number, code, status, priority, created_at, resolved_at, closed_at, external_reference");
  if (ticket_id) query = query.eq("id", ticket_id);
  else if (external_reference) query = query.eq("external_reference", external_reference);
  else {
    return new Response(JSON.stringify({ error: "ticket_id or external_reference required" }), {
      status: 400, headers: { ...headers, "Content-Type": "application/json" },
    });
  }

  const { data, error } = await query.single();
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, ticket: data }), {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
