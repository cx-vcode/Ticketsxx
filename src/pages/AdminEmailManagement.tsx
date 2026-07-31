import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { motion } from 'framer-motion';
import {
  Mail, Send, Loader2, Users, AlertTriangle, Eye, FileText, CheckCircle2,
  MailCheck, Settings2, Sparkles, Copy, Palette
} from 'lucide-react';

// ── Email templates for broadcast ──
const broadcastTemplates = [
  {
    id: 'maintenance',
    name: '🔧 صيانة مجدولة',
    subject: 'إشعار صيانة مجدولة للنظام',
    body: 'نود إعلامكم بأنه سيتم إجراء صيانة مجدولة للنظام في:\n\n📅 التاريخ: [أدخل التاريخ]\n⏰ الوقت: [أدخل الوقت]\n⏱️ المدة المتوقعة: [أدخل المدة]\n\nخلال هذه الفترة قد تتأثر بعض الخدمات. نعتذر عن أي إزعاج.',
  },
  {
    id: 'update',
    name: '🚀 تحديث جديد',
    subject: 'تحديث جديد على النظام',
    body: 'يسعدنا إبلاغكم بإطلاق تحديث جديد يتضمن:\n\n✅ [ميزة 1]\n✅ [ميزة 2]\n✅ [ميزة 3]\n\nلمزيد من التفاصيل، يرجى مراجعة قاعدة المعرفة.',
  },
  {
    id: 'security',
    name: '🔒 تنبيه أمني',
    subject: 'تنبيه أمني مهم',
    body: 'نود لفت انتباهكم إلى تحديث أمني مهم:\n\n⚠️ [وصف التنبيه]\n\nالإجراءات المطلوبة:\n1. [إجراء 1]\n2. [إجراء 2]\n\nفي حال وجود أي استفسار، يرجى التواصل مع فريق الدعم.',
  },
  {
    id: 'welcome',
    name: '👋 ترحيب',
    subject: 'مرحباً بكم في النظام',
    body: 'مرحباً بكم في نظام إدارة التذاكر!\n\nيسعدنا انضمامكم. إليكم بعض النصائح للبدء:\n\n📌 يمكنكم إنشاء تذكرة جديدة من القائمة الرئيسية\n📌 تتبعوا حالة تذاكركم من لوحة المتابعة\n📌 استعرضوا قاعدة المعرفة للحلول الشائعة\n\nفريق الدعم متاح لمساعدتكم في أي وقت.',
  },
];

// ── Email Preview Component ──
function EmailPreview({ subject, body, senderName }: { subject: string; body: string; senderName: string }) {
  return (
    <div className="border rounded-xl overflow-hidden bg-background">
      <div className="bg-gradient-to-l from-primary to-primary/80 p-4 text-primary-foreground">
        <h3 className="font-bold text-sm">📢 {subject || 'موضوع البريد'}</h3>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-sm text-muted-foreground">مرحباً عزيزي المستخدم،</p>
        <div className="bg-muted/30 rounded-lg p-4 border text-sm whitespace-pre-wrap text-foreground min-h-[80px]">
          {body || 'محتوى الرسالة يظهر هنا...'}
        </div>
        <div className="text-center pt-2 border-t">
          <p className="text-[10px] text-muted-foreground">هذا الإشعار مُرسل من نظام {senderName}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminEmailManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Email config state
  const [senderName, setSenderName] = useState('Ticket-X');
  const [senderEmail, setSenderEmail] = useState('notify@ticket-x.com');
  const [emailProvider, setEmailProvider] = useState<string>('resend');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('tls');
  const [configSaving, setConfigSaving] = useState(false);

  // Notification toggles
  const [notifyOnCreate, setNotifyOnCreate] = useState(true);
  const [notifyOnAssign, setNotifyOnAssign] = useState(true);
  const [notifyOnStatus, setNotifyOnStatus] = useState(true);
  const [notifyOnComment, setNotifyOnComment] = useState(true);
  const [notifyOnSLA, setNotifyOnSLA] = useState(true);

  // Broadcast state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTarget, setEmailTarget] = useState('all');
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Load settings
  const { data: settings = [] } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', [
          'email_sender_name', 'email_sender_address', 'email_provider',
          'smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_encryption',
          'notify_on_create', 'notify_on_assign', 'notify_on_status',
          'notify_on_comment', 'notify_on_sla',
        ]);
      if (data) {
        data.forEach((s: any) => {
           if (s.key === 'email_sender_name') setSenderName(s.value || 'Ticket-X');
           if (s.key === 'email_sender_address') setSenderEmail(s.value || 'notify@ticket-x.com');
          if (s.key === 'email_provider') setEmailProvider(s.value || 'resend');
          if (s.key === 'smtp_host') setSmtpHost(s.value || '');
          if (s.key === 'smtp_port') setSmtpPort(s.value || '587');
          if (s.key === 'smtp_username') setSmtpUsername(s.value || '');
          if (s.key === 'smtp_password') setSmtpPassword(s.value || '');
          if (s.key === 'smtp_encryption') setSmtpEncryption(s.value || 'tls');
          if (s.key === 'notify_on_create') setNotifyOnCreate(s.value !== 'false');
          if (s.key === 'notify_on_assign') setNotifyOnAssign(s.value !== 'false');
          if (s.key === 'notify_on_status') setNotifyOnStatus(s.value !== 'false');
          if (s.key === 'notify_on_comment') setNotifyOnComment(s.value !== 'false');
          if (s.key === 'notify_on_sla') setNotifyOnSLA(s.value !== 'false');
        });
      }
      return data || [];
    },
  });

  // Load email stats
  const { data: emailStats } = useQuery({
    queryKey: ['email-stats'],
    queryFn: async () => {
      const { count: totalNotifications } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      const { count: todayNotifications } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      return {
        totalNotifications: totalNotifications || 0,
        todayNotifications: todayNotifications || 0,
        totalUsers: totalUsers || 0,
      };
    },
  });

  const saveEmailConfig = async () => {
    setConfigSaving(true);
    try {
      const entries = [
        { key: 'email_sender_name', value: senderName },
        { key: 'email_sender_address', value: senderEmail },
        { key: 'email_provider', value: emailProvider },
        { key: 'smtp_host', value: smtpHost },
        { key: 'smtp_port', value: smtpPort },
        { key: 'smtp_username', value: smtpUsername },
        { key: 'smtp_password', value: smtpPassword },
        { key: 'smtp_encryption', value: smtpEncryption },
        { key: 'notify_on_create', value: String(notifyOnCreate) },
        { key: 'notify_on_assign', value: String(notifyOnAssign) },
        { key: 'notify_on_status', value: String(notifyOnStatus) },
        { key: 'notify_on_comment', value: String(notifyOnComment) },
        { key: 'notify_on_sla', value: String(notifyOnSLA) },
      ];
      for (const entry of entries) {
        const { data: existing } = await supabase
          .from('system_settings')
          .select('id')
          .eq('key', entry.key)
          .single();
        if (existing) {
          await supabase.from('system_settings').update({ value: entry.value }).eq('key', entry.key);
        } else {
          await supabase.from('system_settings').insert(entry);
        }
      }
      toast({ title: 'تم حفظ إعدادات البريد ✅' });
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
    } catch (err: any) {
      toast({ title: 'خطأ', description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setConfigSaving(false);
    }
  };

  const applyTemplate = (templateId: string) => {
    const tpl = broadcastTemplates.find(t => t.id === templateId);
    if (tpl) {
      setEmailSubject(tpl.subject);
      setEmailBody(tpl.body);
      toast({ title: `تم تطبيق قالب "${tpl.name}" ✅` });
    }
  };

  const sendBroadcastEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: 'يرجى تعبئة الموضوع والمحتوى', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await supabase.functions.invoke('broadcast-email', {
        body: { subject: emailSubject.trim(), body: emailBody.trim(), target: emailTarget },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: 'تم إرسال الإشعار بنجاح ✅', description: `تم الإرسال إلى ${res.data?.sent_count || 0} مستخدم` });
      setEmailSubject('');
      setEmailBody('');
    } catch (err: any) {
      toast({ title: 'خطأ في الإرسال', description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({ title: 'أدخل بريداً إلكترونياً للاختبار', variant: 'destructive' });
      return;
    }
    setSendingTest(true);
    try {
      const res = await supabase.functions.invoke('broadcast-email', {
        body: {
          subject: 'رسالة اختبار من النظام',
          body: 'هذه رسالة اختبارية للتحقق من إعدادات البريد الإلكتروني.\n\nإذا وصلتك هذه الرسالة، فإن الإعدادات تعمل بشكل صحيح ✅',
          target: 'test',
          test_email: testEmail.trim(),
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: 'تم إرسال رسالة الاختبار ✅', description: `إلى ${testEmail}` });
    } catch (err: any) {
      toast({ title: 'خطأ', description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setSendingTest(false);
    }
  };

  const targetLabels: Record<string, string> = {
    all: 'جميع المستخدمين',
    admin: 'الأدمن فقط',
    agent: 'الدعم الفني فقط',
    developer: 'المطورين فقط',
    requester: 'العملاء فقط',
  };

  return (
    <PageLayout>
      <PageHeader
        title="إدارة البريد الإلكتروني"
        icon={<Mail className="h-4 w-4" />}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <MailCheck className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{emailStats?.totalNotifications || 0}</p>
                        <p className="text-xs text-muted-foreground">إجمالي الإشعارات</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center">
                        <Send className="h-6 w-6 text-success" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{emailStats?.todayNotifications || 0}</p>
                        <p className="text-xs text-muted-foreground">إشعارات اليوم</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Card className="rounded-2xl">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-info/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-info" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{emailStats?.totalUsers || 0}</p>
                        <p className="text-xs text-muted-foreground">مستخدمين نشطين</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              <Tabs defaultValue="config" dir="rtl">
                <TabsList className="mb-4 w-full justify-start flex-wrap">
                  <TabsTrigger value="config" className="gap-2"><Settings2 className="h-4 w-4" />إعدادات البريد</TabsTrigger>
                  <TabsTrigger value="notifications" className="gap-2"><MailCheck className="h-4 w-4" />إشعارات التذاكر</TabsTrigger>
                  <TabsTrigger value="broadcast" className="gap-2"><Send className="h-4 w-4" />إرسال جماعي</TabsTrigger>
                  <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />قوالب البريد</TabsTrigger>
                </TabsList>

                {/* ── Tab: Email Config ── */}
                <TabsContent value="config">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    {/* Provider Selection */}
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" />مزوّد خدمة البريد</CardTitle>
                        <CardDescription>اختر طريقة إرسال البريد الإلكتروني من النظام</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setEmailProvider('resend')}
                            className={`p-4 border-2 rounded-xl text-right transition-all ${emailProvider === 'resend' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'}`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Sparkles className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-foreground">Resend API</p>
                                <p className="text-xs text-muted-foreground">خدمة بريد سحابية سريعة</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">يستخدم مفتاح API فقط — لا حاجة لإعدادات خادم. مناسب للبدء السريع.</p>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmailProvider('smtp')}
                            className={`p-4 border-2 rounded-xl text-right transition-all ${emailProvider === 'smtp' ? 'border-primary bg-primary/5 shadow-sm' : 'border-border hover:border-primary/40'}`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                                <Mail className="h-5 w-5 text-accent-foreground" />
                              </div>
                              <div>
                                <p className="font-bold text-sm text-foreground">SMTP مخصص</p>
                                <p className="text-xs text-muted-foreground">خادم بريد خاص بك</p>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Gmail, Outlook, أو أي خادم SMTP خاص. تحكم كامل في الإرسال.</p>
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sender Identity */}
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />هوية المرسل</CardTitle>
                        <CardDescription>الاسم والبريد الذي يظهر للمستلم</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>اسم المرسل</Label>
                            <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Ticket-X" />
                            <p className="text-xs text-muted-foreground">الاسم الذي يظهر في صندوق الوارد</p>
                          </div>
                          <div className="space-y-2">
                            <Label>عنوان المرسل</Label>
                            <Input value={senderEmail} onChange={e => setSenderEmail(e.target.value)} placeholder="notify@domain.com" />
                            <p className="text-xs text-muted-foreground">{emailProvider === 'smtp' ? 'يجب أن يتطابق مع حساب SMTP' : 'يتطلب تهيئة نطاق في Resend'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* SMTP Settings */}
                    {emailProvider === 'smtp' && (
                      <Card className="rounded-2xl border-primary/20">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />إعدادات خادم SMTP</CardTitle>
                          <CardDescription>أدخل بيانات خادم البريد الصادر</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>عنوان الخادم (Host)</Label>
                              <Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" dir="ltr" />
                            </div>
                            <div className="space-y-2">
                              <Label>المنفذ (Port)</Label>
                              <Input value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" dir="ltr" type="number" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>اسم المستخدم</Label>
                              <Input value={smtpUsername} onChange={e => setSmtpUsername(e.target.value)} placeholder="user@gmail.com" dir="ltr" />
                            </div>
                            <div className="space-y-2">
                              <Label>كلمة المرور</Label>
                              <Input value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="••••••••" type="password" dir="ltr" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>التشفير</Label>
                            <Select value={smtpEncryption} onValueChange={setSmtpEncryption}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tls">TLS (المنفذ 587 - موصى به)</SelectItem>
                                <SelectItem value="ssl">SSL (المنفذ 465)</SelectItem>
                                <SelectItem value="none">بدون تشفير (المنفذ 25)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="border rounded-xl p-4 bg-muted/20">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">ملاحظات مهمة</p>
                                <ul className="space-y-1 list-disc mr-4">
                                  <li>لـ Gmail: استخدم كلمة مرور التطبيقات (App Password) وليس كلمة المرور العادية</li>
                                  <li>لـ Outlook/Office 365: استخدم <code className="bg-muted px-1 rounded" dir="ltr">smtp.office365.com</code> المنفذ 587</li>
                                  <li>تأكد من تفعيل الوصول لتطبيقات أقل أماناً أو إنشاء كلمة مرور تطبيقات</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Resend note */}
                    {emailProvider === 'resend' && (
                      <Card className="rounded-2xl border-primary/20">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />إعدادات Resend API</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-xl p-4 bg-primary/5">
                            <div className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">مفتاح API مُعدّ</p>
                                <p>مفتاح Resend API مُخزّن بشكل آمن في إعدادات النظام. لتغييره، تواصل مع مسؤول النظام.</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Test Email */}
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />اختبار الاتصال</CardTitle>
                        <CardDescription>أرسل رسالة تجريبية للتأكد من صحة الإعدادات</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            placeholder="test@example.com"
                            type="email"
                            className="flex-1"
                            dir="ltr"
                          />
                          <Button onClick={sendTestEmail} disabled={sendingTest} variant="outline">
                            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            <span className="mr-1">إرسال تجريبي</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Button onClick={saveEmailConfig} disabled={configSaving} className="w-full" size="lg">
                      {configSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                      حفظ جميع الإعدادات
                    </Button>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: Notification Toggles ── */}
                <TabsContent value="notifications">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MailCheck className="h-5 w-5 text-primary" />إشعارات التذاكر بالبريد</CardTitle>
                        <CardDescription>تحكم في أنواع الإشعارات البريدية التي يتم إرسالها تلقائياً</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { label: 'إنشاء تذكرة جديدة', desc: 'إشعار المشرفين عند إنشاء تذكرة', checked: notifyOnCreate, onChange: setNotifyOnCreate },
                          { label: 'تعيين تذكرة', desc: 'إشعار الوكيل المعيّن', checked: notifyOnAssign, onChange: setNotifyOnAssign },
                          { label: 'تغيير حالة التذكرة', desc: 'إشعار مقدم الطلب والوكيل', checked: notifyOnStatus, onChange: setNotifyOnStatus },
                          { label: 'تعليق جديد', desc: 'إشعار أطراف التذكرة بالتعليقات الجديدة', checked: notifyOnComment, onChange: setNotifyOnComment },
                          { label: 'تنبيهات SLA', desc: 'إشعار عند اقتراب أو تجاوز مهلة SLA', checked: notifyOnSLA, onChange: setNotifyOnSLA },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div>
                              <p className="font-medium text-sm text-foreground">{item.label}</p>
                              <p className="text-xs text-muted-foreground">{item.desc}</p>
                            </div>
                            <Switch checked={item.checked} onCheckedChange={item.onChange} />
                          </div>
                        ))}

                        <Button onClick={saveEmailConfig} disabled={configSaving} className="w-full">
                          {configSaving && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                          حفظ الإعدادات
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: Broadcast ── */}
                <TabsContent value="broadcast">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card className="rounded-2xl">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" />إرسال إشعار جماعي</CardTitle>
                          <CardDescription>أرسل بريداً إلكترونياً لفئة محددة من المستخدمين</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Quick templates */}
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2"><FileText className="h-3 w-3" />قالب سريع</Label>
                            <div className="flex flex-wrap gap-2">
                              {broadcastTemplates.map(tpl => (
                                <Button
                                  key={tpl.id}
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => applyTemplate(tpl.id)}
                                >
                                  {tpl.name}
                                </Button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>الفئة المستهدفة</Label>
                            <Select value={emailTarget} onValueChange={setEmailTarget}>
                              <SelectTrigger>
                                <Users className="h-4 w-4 ml-2" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">جميع المستخدمين</SelectItem>
                                <SelectItem value="admin">الأدمن فقط</SelectItem>
                                <SelectItem value="agent">الدعم الفني فقط</SelectItem>
                                <SelectItem value="developer">المطورين فقط</SelectItem>
                                <SelectItem value="requester">العملاء فقط</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>موضوع البريد *</Label>
                            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="مثال: تحديث مهم على النظام" maxLength={200} />
                          </div>

                          <div className="space-y-2">
                            <Label>محتوى الرسالة *</Label>
                            <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="اكتب محتوى الرسالة هنا..." rows={8} maxLength={5000} />
                            <p className="text-xs text-muted-foreground">{emailBody.length}/5000 حرف</p>
                          </div>

                          <div className="border rounded-xl p-3 bg-muted/20">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground">
                                سيتم الإرسال إلى جميع المستخدمين النشطين في فئة <Badge variant="secondary" className="mx-1">{targetLabels[emailTarget]}</Badge>
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => setShowPreview(!showPreview)}
                              variant="outline"
                              className="flex-1 gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              {showPreview ? 'إخفاء المعاينة' : 'معاينة'}
                            </Button>
                            <Button
                              onClick={sendBroadcastEmail}
                              disabled={sending || !emailSubject.trim() || !emailBody.trim()}
                              className="flex-1 gap-2"
                            >
                              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                              إرسال الإشعار
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Preview */}
                      <div className="space-y-4">
                        <Card className="rounded-2xl">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4 text-primary" />معاينة الرسالة</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <EmailPreview subject={emailSubject} body={emailBody} senderName={senderName} />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>

                {/* ── Tab: Auth Templates ── */}
                <TabsContent value="templates">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="rounded-2xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />قوالب رسائل المصادقة</CardTitle>
                        <CardDescription>قوالب البريد الإلكتروني المخصصة لرسائل تسجيل الدخول والمصادقة</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          { name: 'تأكيد التسجيل', file: 'signup.tsx', status: 'active', desc: 'رسالة تأكيد البريد الإلكتروني عند إنشاء حساب جديد' },
                          { name: 'استعادة كلمة المرور', file: 'recovery.tsx', status: 'active', desc: 'رسالة إعادة تعيين كلمة المرور' },
                          { name: 'رابط سحري', file: 'magic-link.tsx', status: 'active', desc: 'رسالة تسجيل الدخول بدون كلمة مرور' },
                          { name: 'دعوة مستخدم', file: 'invite.tsx', status: 'active', desc: 'رسالة دعوة مستخدم جديد للانضمام' },
                          { name: 'تغيير البريد', file: 'email-change.tsx', status: 'active', desc: 'رسالة تأكيد تغيير عنوان البريد الإلكتروني' },
                          { name: 'إعادة المصادقة', file: 'reauthentication.tsx', status: 'active', desc: 'رسالة رمز OTP لإعادة التحقق' },
                        ].map((tpl, i) => (
                          <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Mail className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm text-foreground">{tpl.name}</p>
                                <p className="text-xs text-muted-foreground">{tpl.desc}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="gap-1 text-success border-success/30">
                                <CheckCircle2 className="h-3 w-3" />
                                مفعّل
                              </Badge>
                            </div>
                          </div>
                        ))}

                        <div className="border rounded-xl p-4 bg-primary/5">
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <div className="text-xs text-muted-foreground">
                              <p className="font-medium text-foreground mb-1">قوالب مخصصة بالكامل</p>
                              <p>جميع قوالب المصادقة مُهيأة بتصميم عربي احترافي يدعم RTL مع خط Tajawal وألوان النظام. يتم إرسالها تلقائياً عبر نطاق <code className="bg-muted px-1 rounded">notify.ticket-x.com</code></p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </TabsContent>
              </Tabs>
            </div>
      </main>
    </PageLayout>
  );
}
