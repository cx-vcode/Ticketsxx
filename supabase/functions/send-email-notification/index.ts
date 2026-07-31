import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

async function getEmailConfig(adminClient: any) {
  const keys = [
    "email_provider", "email_sender_name", "email_sender_address",
    "smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_encryption",
  ];
  const { data } = await adminClient.from("system_settings").select("key, value").in("key", keys);
  const config: Record<string, string> = {};
  (data || []).forEach((s: any) => { config[s.key] = s.value || ""; });
  return {
    provider: config.email_provider || "resend",
    senderName: config.email_sender_name || "نظام التذاكر",
    senderAddress: config.email_sender_address || "notifications@resend.dev",
    smtp: {
      host: config.smtp_host || "",
      port: parseInt(config.smtp_port || "587"),
      username: config.smtp_username || "",
      password: config.smtp_password || "",
      tls: (config.smtp_encryption || "tls") !== "none",
    },
  };
}

async function sendViaResend(from: string, to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

async function sendViaSMTP(config: any, from: string, fromName: string, to: string, subject: string, html: string) {
  try {
    const client = new SMTPClient({
      connection: {
        hostname: config.host,
        port: config.port,
        tls: config.tls,
        auth: { username: config.username, password: config.password },
      },
    });
    await client.send({
      from: `${fromName} <${from}>`,
      to: to,
      subject,
      content: "auto",
      html,
    });
    await client.close();
    return true;
  } catch (e) {
    console.error("SMTP error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.replace("Bearer ", "");
    const isAnonKeyCall = token === supabaseAnonKey;

    if (!isAnonKeyCall) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await authClient.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const sb = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roleData } = await sb.from("user_roles").select("role").eq("user_id", user.id).single();
      if (!roleData || !["admin", "agent"].includes(roleData.role)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { ticket_id, event_type, recipient_email, recipient_name, ticket_number, ticket_title, details } = await req.json();

    if (!ticket_id || !event_type || !recipient_email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const emailConfig = await getEmailConfig(adminClient);

    const subjectMap: Record<string, string> = {
      status_changed: `تحديث حالة التذكرة #${ticket_number}`,
      assigned: `تم تعيين التذكرة #${ticket_number} لك`,
      comment_added: `تعليق جديد على التذكرة #${ticket_number}`,
      sla_warning: `⚠️ تنبيه SLA - التذكرة #${ticket_number}`,
      resolved: `✅ تم حل التذكرة #${ticket_number}`,
      created: `تذكرة جديدة #${ticket_number}`,
      approval_escalated: `⚠️ تصعيد اعتماد - التذكرة #${ticket_number}`,
      priority_changed: `تغيير أولوية التذكرة #${ticket_number}`,
    };

    const subject = subjectMap[event_type] || `تحديث التذكرة #${ticket_number}`;

    const eventLabelMap: Record<string, string> = {
      status_changed: "تغيير الحالة", assigned: "تعيين", comment_added: "تعليق جديد",
      sla_warning: "تنبيه SLA", resolved: "تم الحل", created: "تذكرة جديدة",
      approval_escalated: "تصعيد اعتماد", priority_changed: "تغيير الأولوية",
    };
    const eventLabel = eventLabelMap[event_type] || event_type;

    const htmlBody = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;">🎫 ${emailConfig.senderName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">${eventLabel}</p>
          <h2 style="margin:0 0 16px;color:#1f2937;font-size:18px;">${subject}</h2>
          <table width="100%" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:20px;" cellpadding="8">
            <tr><td style="color:#6b7280;font-size:13px;width:100px;">رقم التذكرة</td><td style="color:#1f2937;font-size:14px;font-weight:600;">#${ticket_number}</td></tr>
            <tr><td style="color:#6b7280;font-size:13px;">العنوان</td><td style="color:#1f2937;font-size:14px;">${ticket_title || "—"}</td></tr>
          </table>
          ${details ? `<div style="background:#f0f4ff;border-right:4px solid #6366f1;border-radius:6px;padding:14px 16px;margin-bottom:20px;"><p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${details}</p></div>` : ""}
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">هذه رسالة تلقائية من ${emailConfig.senderName}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    let emailSent = false;
    const fromFull = `${emailConfig.senderName} <${emailConfig.senderAddress}>`;

    if (emailConfig.provider === "smtp" && emailConfig.smtp.host) {
      emailSent = await sendViaSMTP(emailConfig.smtp, emailConfig.senderAddress, emailConfig.senderName, recipient_email, subject, htmlBody);
      if (emailSent) console.log(`✅ Email sent to ${recipient_email} via SMTP`);
      else console.error(`❌ SMTP send failed for ${recipient_email}`);
    } else {
      emailSent = await sendViaResend(fromFull, recipient_email, subject, htmlBody);
      if (emailSent) console.log(`✅ Email sent to ${recipient_email} via Resend`);
      else console.warn(`⚠️ Resend send failed or not configured for ${recipient_email}`);
    }

    // Insert notification (bilingual payload)
    const { data: profile } = await adminClient.from("profiles").select("id").eq("email", recipient_email).single();
    if (profile) {
      const message = details || subject;
      await adminClient.from("notifications").insert({
        user_id: profile.id,
        ticket_id,
        title: subject,
        message,
        type: event_type,
        data: {
          title_ar: subject,
          title_en: subject,
          message_ar: message,
          message_en: message,
        },
      });
    }

    return new Response(JSON.stringify({ success: true, email_sent: emailSent, provider: emailConfig.provider, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
