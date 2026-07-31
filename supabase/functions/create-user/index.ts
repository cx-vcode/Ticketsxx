import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("غير مصرح");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || serviceRoleKey);
  const { data: { user: caller }, error: authError } = await anonClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authError || !caller) throw new Error("غير مصرح");

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .single();

  if (!roleData || roleData.role !== "admin") throw new Error("صلاحيات غير كافية");

  return { caller, adminClient, supabaseUrl, serviceRoleKey };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caller, adminClient } = await verifyAdmin(req);
    const body = await req.json();
    const action = body.action || "create";

    // =================== CREATE USER ===================
    if (action === "create") {
      const { email, password, full_name, role, job_title, phone, mobile, employee_number } = body;
      if (!email || !password || !full_name) {
        return new Response(JSON.stringify({ error: "البريد وكلمة المرور والاسم مطلوبة" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (role && role !== "requester" && newUser.user) {
        await adminClient.from("user_roles").update({ role }).eq("user_id", newUser.user.id);
      }

      if (newUser.user) {
        const profileUpdates: Record<string, any> = {};
        if (job_title) profileUpdates.job_title = job_title;
        if (phone) profileUpdates.phone = phone;
        if (mobile) profileUpdates.mobile = mobile;
        if (employee_number) profileUpdates.employee_number = employee_number;
        if (Object.keys(profileUpdates).length > 0) {
          await adminClient.from("profiles").update(profileUpdates).eq("id", newUser.user.id);
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =================== UPDATE USER ===================
    if (action === "update") {
      const { user_id, full_name, email, job_title, department_id, is_active,
              phone, mobile, city, country, employee_number, manager_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id مطلوب" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile
      const profileUpdates: Record<string, any> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (job_title !== undefined) profileUpdates.job_title = job_title;
      if (department_id !== undefined) profileUpdates.department_id = department_id || null;
      if (is_active !== undefined) profileUpdates.is_active = is_active;
      if (phone !== undefined) profileUpdates.phone = phone;
      if (mobile !== undefined) profileUpdates.mobile = mobile;
      if (city !== undefined) profileUpdates.city = city;
      if (country !== undefined) profileUpdates.country = country;
      if (employee_number !== undefined) profileUpdates.employee_number = employee_number;
      if (manager_id !== undefined) profileUpdates.manager_id = manager_id || null;

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await adminClient.from("profiles").update(profileUpdates).eq("id", user_id);
        if (error) throw new Error(error.message);
      }

      // Update email in auth if changed
      if (email) {
        const { error } = await adminClient.auth.admin.updateUserById(user_id, { email });
        if (error) throw new Error(error.message);
        await adminClient.from("profiles").update({ email }).eq("id", user_id);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =================== DELETE USER ===================
    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id مطلوب" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "لا يمكنك حذف حسابك" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Deactivate profile first and remove role
      await adminClient.from("profiles").update({ is_active: false }).eq("id", user_id);
      await adminClient.from("user_roles").delete().eq("user_id", user_id);
      await adminClient.from("developer_access").delete().eq("developer_id", user_id);

      // Try hard delete, if it fails due to FK constraints, just ban the user
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) {
        // Can't fully delete due to existing data - ban instead
        await adminClient.auth.admin.updateUserById(user_id, { ban_duration: "876600h" }); // ~100 years
        console.log(`User ${user_id} banned instead of deleted: ${error.message}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "إجراء غير معروف" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "غير مصرح" ? 401 : msg === "صلاحيات غير كافية" ? 403 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
