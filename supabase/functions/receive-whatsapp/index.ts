import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Twilio sends webhooks as application/x-www-form-urlencoded
    const formData = await req.formData();
    const from = formData.get("From")?.toString() || "";
    const to = formData.get("To")?.toString() || "";
    const body = formData.get("Body")?.toString() || "";
    const messageSid = formData.get("MessageSid")?.toString() || "";
    const numMedia = parseInt(formData.get("NumMedia")?.toString() || "0");
    const mediaUrl = numMedia > 0 ? formData.get("MediaUrl0")?.toString() : null;

    console.log(`Received WhatsApp message from ${from}: ${body}`);

    // Save incoming message
    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      direction: "inbound",
      from_number: from,
      to_number: to,
      body,
      media_url: mediaUrl,
      twilio_sid: messageSid,
      status: "received",
    });

    if (msgError) {
      console.error("Failed to save message:", msgError);
    }

    // Try to find or create a ticket for this conversation
    const phoneNumber = from.replace("whatsapp:", "");
    
    // Check if there's an existing open ticket from this number
    const { data: existingMessages } = await supabase
      .from("whatsapp_messages")
      .select("ticket_id")
      .eq("from_number", from)
      .not("ticket_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    let ticketId = existingMessages?.[0]?.ticket_id;

    if (!ticketId) {
      // Create a new ticket from WhatsApp message
      // Use a system/default requester for unregistered contacts
      const { data: adminUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
        .limit(1);

      if (adminUsers && adminUsers.length > 0) {
        const { data: newTicket, error: ticketError } = await supabase
          .from("tickets")
          .insert({
            title: `رسالة WhatsApp من ${phoneNumber}`,
            description: body,
            requester_id: adminUsers[0].user_id,
            source_system: "PORTAL",
            priority: "medium",
          })
          .select("id")
          .single();

        if (newTicket) {
          ticketId = newTicket.id;
          // Update the message with ticket_id
          await supabase
            .from("whatsapp_messages")
            .update({ ticket_id: ticketId })
            .eq("twilio_sid", messageSid);
        }
      }
    } else {
      // Link message to existing ticket
      await supabase
        .from("whatsapp_messages")
        .update({ ticket_id: ticketId })
        .eq("twilio_sid", messageSid);

      // Add as a comment on the ticket
      if (ticketId) {
        const { data: adminUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1);

        if (adminUsers?.[0]) {
          await supabase.from("ticket_comments").insert({
            ticket_id: ticketId,
            author_id: adminUsers[0].user_id,
            content: `📱 رسالة WhatsApp من ${phoneNumber}:\n${body}`,
            note_type: "public",
          });
        }
      }
    }

    // Respond to Twilio with TwiML
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }
    );
  } catch (error: unknown) {
    console.error("Error processing WhatsApp webhook:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "application/xml" } }
    );
  }
});
