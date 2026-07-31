import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    senderName: config.email_sender_name || "Ticket-X",
    senderAddress: config.email_sender_address || "notify@ticket-x.com",
    smtp: {
      host: config.smtp_host || "",
      port: parseInt(config.smtp_port || "587"),
      username: config.smtp_username || "",
      password: config.smtp_password || "",
      tls: (config.smtp_encryption || "tls") !== "none",
    },
  };
}

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
    await client.send({ from: `${fromName} <${from}>`, to, subject, content: "auto", html });
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("غير مصرح");

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey);
    const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !caller) throw new Error("غير مصرح");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).single();
    if (!roleData || roleData.role !== "admin") throw new Error("صلاحيات غير كافية");

    const { subject, body, target, test_email } = await req.json();
    if (!subject || !body) {
      return new Response(JSON.stringify({ error: "الموضوع والمحتوى مطلوبان" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get email config
    const emailConfig = await getEmailConfig(adminClient);

    if (emailConfig.provider === "resend" && !resendApiKey) {
      return new Response(JSON.stringify({ error: "خدمة Resend غير مهيئة (RESEND_API_KEY مفقود)" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (emailConfig.provider === "smtp" && !emailConfig.smtp.host) {
      return new Response(JSON.stringify({ error: "إعدادات SMTP غير مكتملة — أدخل عنوان الخادم من صفحة الإعدادات" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build user list
    let users: any[] = [];
    if (target === "test" && test_email) {
      users = [{ email: test_email, full_name: "مستخدم اختبار" }];
    } else {
      let query = adminClient.from("profiles").select("email, full_name").eq("is_active", true);
      if (target && target !== "all") {
        const { data: targetUsers } = await adminClient.from("user_roles").select("user_id").eq("role", target);
        const userIds = (targetUsers || []).map((u: any) => u.user_id);
        if (userIds.length === 0) {
          return new Response(JSON.stringify({ sent_count: 0, message: "لا يوجد مستخدمين في هذه الفئة" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        query = query.in("id", userIds);
      }
      const { data: fetchedUsers } = await query;
      users = fetchedUsers || [];
    }

    if (users.length === 0) {
      return new Response(JSON.stringify({ sent_count: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const batchSize = emailConfig.provider === "smtp" ? 5 : 10;

    // Create SMTP client once for all emails if using SMTP
    let smtpClient: SMTPClient | null = null;
    if (emailConfig.provider === "smtp") {
      try {
        smtpClient = new SMTPClient({
          connection: {
            hostname: emailConfig.smtp.host,
            port: emailConfig.smtp.port,
            tls: emailConfig.smtp.tls,
            auth: { username: emailConfig.smtp.username, password: emailConfig.smtp.password },
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "فشل الاتصال بخادم SMTP: " + (e as Error).message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const promises = batch.map(async (user: any) => {
        try {
          const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
body{font-family:'Tajawal',sans-serif;background:#f5f5f5;margin:0;padding:40px 20px}
.container{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.header{background:linear-gradient(135deg,#2d8b6e,#1a5c47);padding:24px 32px;color:#fff}
.header h1{margin:0;font-size:20px;font-weight:700}
.body{padding:32px}
.body p{line-height:1.8;color:#333;margin:0 0 16px}
.greeting{font-size:15px;color:#555;margin-bottom:20px}
.content{background:#f9fafb;border-radius:8px;padding:20px;border:1px solid #e5e7eb;white-space:pre-wrap}
.footer{padding:20px 32px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee}
</style></head>
<body><div class="container">
<div class="header"><h1>📢 ${subject}</h1></div>
<div class="body">
<p class="greeting">مرحباً ${user.full_name || 'عزيزي المستخدم'}،</p>
<div class="content">${body.replace(/\n/g, '<br>')}</div>
</div>
<div class="footer">هذا الإشعار مُرسل من نظام ${emailConfig.senderName}</div>
</div></body></html>`;

          let sent = false;
          if (emailConfig.provider === "smtp" && smtpClient) {
            try {
              await smtpClient.send({
                from: `${emailConfig.senderName} <${emailConfig.senderAddress}>`,
                to: user.email,
                subject: `📢 ${subject}`,
                content: "auto",
                html: htmlContent,
              });
              sent = true;
            } catch (e) {
              console.error(`SMTP send failed for ${user.email}:`, e);
            }
          } else if (resendApiKey) {
            sent = await sendViaResend(
              resendApiKey,
              `${emailConfig.senderName} <${emailConfig.senderAddress}>`,
              user.email,
              `📢 ${subject}`,
              htmlContent
            );
          }
          if (sent) sentCount++;
        } catch (e) {
          console.error(`Failed to send to ${user.email}:`, e);
        }
      });
      await Promise.all(promises);
    }

    // Close SMTP connection
    if (smtpClient) {
      try { await smtpClient.close(); } catch (_) { /* ignore */ }
    }

    return new Response(JSON.stringify({
      success: true, sent_count: sentCount, total: users.length, provider: emailConfig.provider,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "غير مصرح" ? 401 : msg === "صلاحيات غير كافية" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
