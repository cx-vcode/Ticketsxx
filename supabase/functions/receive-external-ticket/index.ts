import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validSources = ["ERP", "LMS", "CPAY", "PORTAL", "SIS", "EDUMALLS", "SMART_SCHOOL", "DASHBOARD", "HR"];
const validPriorities = ["low", "medium", "high", "urgent"];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate API key header
    const apiKey = req.headers.get("x-api-key");
    const expectedKey = Deno.env.get("EXTERNAL_API_KEY");
    if (expectedKey && apiKey !== expectedKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const { source_system, title, description, priority, external_reference, external_payload, requester_email, service_name, category_name } = body;

    // Validate required fields
    if (!source_system || !title || !description || !requester_email) {
      return new Response(JSON.stringify({
        error: "Missing required fields",
        required: ["source_system", "title", "description", "requester_email"],
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate types
    if (typeof title !== "string" || typeof description !== "string" || typeof requester_email !== "string") {
      return new Response(JSON.stringify({ error: "Invalid field types" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate lengths
    if (title.length > 255) {
      return new Response(JSON.stringify({ error: "Title must not exceed 255 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (description.length > 10000) {
      return new Response(JSON.stringify({ error: "Description must not exceed 10000 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate email format
    if (!emailRegex.test(requester_email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate source_system
    if (!validSources.includes(source_system)) {
      return new Response(JSON.stringify({
        error: `Invalid source_system. Must be one of: ${validSources.join(", ")}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate priority if provided
    if (priority && !validPriorities.includes(priority)) {
      return new Response(JSON.stringify({
        error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}`,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate external_payload size
    if (external_payload) {
      if (typeof external_payload !== "object" || JSON.stringify(external_payload).length > 10000) {
        return new Response(JSON.stringify({ error: "Invalid or oversized external_payload" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Strip HTML tags from title and description for safety
    const sanitizedTitle = title.replace(/<[^>]*>/g, "").trim();
    const sanitizedDescription = description.replace(/<[^>]*>/g, "").trim();

    // Find or create requester profile
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
        user_metadata: { full_name: body.requester_name || requester_email.split("@")[0] },
      });

      if (authError && !authError.message.includes("already")) {
        console.error("[External API] User creation failed:", authError.message);
        return new Response(JSON.stringify({ error: "Failed to process requester information" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (authUser?.user) {
        profile = { id: authUser.user.id };
      } else {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", requester_email)
          .single();
        profile = existingProfile;
      }
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: "Could not find or create requester" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve service and category if provided
    let service_id = null;
    let category_id = null;
    let department_id = null;

    if (service_name) {
      const { data: service } = await supabase
        .from("services")
        .select("id, default_assignment_group")
        .ilike("name", service_name)
        .single();
      if (service) {
        service_id = service.id;
        department_id = service.default_assignment_group;
      }
    }

    if (category_name && service_id) {
      const { data: category } = await supabase
        .from("service_categories")
        .select("id")
        .eq("service_id", service_id)
        .ilike("name", category_name)
        .single();
      if (category) category_id = category.id;
    }

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        title: sanitizedTitle,
        description: sanitizedDescription,
        priority: priority || "medium",
        requester_id: profile.id,
        source_system,
        external_reference: external_reference || null,
        external_payload: external_payload || null,
        service_id,
        category_id,
        department_id,
      })
      .select("id, ticket_number, code, status, priority, created_at")
      .single();

    if (ticketError) {
      console.error("[External API] Ticket creation failed:", ticketError.message);
      return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      ticket: {
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        code: ticket.code,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
      },
    }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[External API] Unhandled error:", error);
    return new Response(JSON.stringify({ error: "An internal error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
