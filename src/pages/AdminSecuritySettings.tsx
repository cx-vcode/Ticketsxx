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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { motion } from 'framer-motion';
import { KeyRound, Shield, Mail, Send, Loader2, Users, Lock, AlertTriangle, Bell, Palette } from 'lucide-react';
import { useLanguage } from '@/i18n';
import { CannedResponsesManager } from '@/components/CannedResponses';

export default function AdminSecuritySettings() {
  const { t, isRTL, lang } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Password policy state
  const [minLength, setMinLength] = useState('8');
  const [requireUppercase, setRequireUppercase] = useState(true);
  const [requireNumbers, setRequireNumbers] = useState(true);
  const [requireSpecial, setRequireSpecial] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [policySaving, setPolicySaving] = useState(false);

  // Broadcast email state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailTarget, setEmailTarget] = useState('all');
  const [sending, setSending] = useState(false);

  // Load settings
  const { data: settings = [] } = useQuery({
    queryKey: ['security-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', ['password_min_length', 'password_require_uppercase', 'password_require_numbers', 'password_require_special', 'session_timeout_minutes']);
      if (data) {
        data.forEach((s: any) => {
          if (s.key === 'password_min_length') setMinLength(s.value || '8');
          if (s.key === 'password_require_uppercase') setRequireUppercase(s.value === 'true');
          if (s.key === 'password_require_numbers') setRequireNumbers(s.value === 'true');
          if (s.key === 'password_require_special') setRequireSpecial(s.value === 'true');
          if (s.key === 'session_timeout_minutes') setSessionTimeout(s.value || '480');
        });
      }
      return data || [];
    },
  });

  const savePasswordPolicy = async () => {
    setPolicySaving(true);
    try {
      const entries = [
        { key: 'password_min_length', value: minLength },
        { key: 'password_require_uppercase', value: String(requireUppercase) },
        { key: 'password_require_numbers', value: String(requireNumbers) },
        { key: 'password_require_special', value: String(requireSpecial) },
        { key: 'session_timeout_minutes', value: sessionTimeout },
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
      toast({ title: t.admin.passwordPolicySaved });
      queryClient.invalidateQueries({ queryKey: ['security-settings'] });
    } catch (err: any) {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setPolicySaving(false);
    }
  };

  const sendBroadcastEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({ title: t.admin.broadcastFieldsRequired, variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await supabase.functions.invoke('broadcast-email', {
        body: { subject: emailSubject.trim(), body: emailBody.trim(), target: emailTarget },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      toast({ title: t.admin.broadcastSent, description: `${t.admin.sentToCount} ${res.data?.sent_count || 0} ${t.admin.usersLabel}` });
      setEmailSubject('');
      setEmailBody('');
    } catch (err: any) {
      toast({ title: t.admin.broadcastError, description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.securitySettingsTitle}
        icon={<Shield className="h-5 w-5" />}
      />

      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-3xl mx-auto">
          <Tabs defaultValue="password" dir={isRTL ? 'rtl' : 'ltr'}>
            <TabsList className="mb-6 w-full justify-start">
              <TabsTrigger value="password" className="gap-2"><KeyRound className="h-4 w-4" />{t.admin.passwordPolicyTab}</TabsTrigger>
              <TabsTrigger value="broadcast" className="gap-2"><Bell className="h-4 w-4" />{t.admin.broadcastTab}</TabsTrigger>
              <TabsTrigger value="customization" className="gap-2"><Palette className="h-4 w-4" />{t.admin.customizationTab}</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <Card className="rounded-2xl border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />{t.admin.passwordPolicyTitle}</CardTitle>
                    <CardDescription>{t.admin.passwordPolicyDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>{t.admin.minPasswordLength}</Label>
                        <Input type="number" min="6" max="32" value={minLength} onChange={e => setMinLength(e.target.value)} />
                        <p className="text-xs text-muted-foreground">{t.admin.minAllowed6}</p>
                      </div>
                      <div className="space-y-2">
                        <Label>{t.admin.sessionTimeoutLabel}</Label>
                        <Input type="number" min="30" value={sessionTimeout} onChange={e => setSessionTimeout(e.target.value)} />
                        <p className="text-xs text-muted-foreground">{t.admin.sessionTimeoutHint}</p>
                      </div>
                    </div>

                    <div className="space-y-4 border rounded-xl p-4 bg-muted/30">
                      <h3 className="font-semibold text-sm text-foreground">{t.admin.complexityRequirements}</h3>
                      <div className="flex items-center justify-between">
                        <Label>{t.admin.uppercaseLetters}</Label>
                        <Switch checked={requireUppercase} onCheckedChange={setRequireUppercase} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t.admin.numbersRequired}</Label>
                        <Switch checked={requireNumbers} onCheckedChange={setRequireNumbers} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>{t.admin.specialCharsRequired}</Label>
                        <Switch checked={requireSpecial} onCheckedChange={setRequireSpecial} />
                      </div>
                    </div>

                    <div className="border rounded-xl p-4 bg-muted/20">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground mb-1">{t.admin.importantNote}</p>
                          <p>{t.admin.passwordPolicyNote}</p>
                        </div>
                      </div>
                    </div>

                    <Button onClick={savePasswordPolicy} disabled={policySaving} className="w-full">
                      {policySaving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
                      {t.admin.savePasswordPolicy}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="broadcast">
              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <Card className="rounded-2xl border-border/50 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />{t.admin.broadcastTitle}</CardTitle>
                    <CardDescription>{t.admin.broadcastDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t.admin.targetAudience}</Label>
                      <Select value={emailTarget} onValueChange={setEmailTarget}>
                        <SelectTrigger>
                          <Users className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t.admin.allUsersTarget}</SelectItem>
                          <SelectItem value="admin">{t.admin.adminsOnly}</SelectItem>
                          <SelectItem value="agent">{t.admin.agentsOnly}</SelectItem>
                          <SelectItem value="developer">{t.admin.developersOnly}</SelectItem>
                          <SelectItem value="requester">{t.admin.requestersOnly}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>{t.admin.emailSubjectLabel}</Label>
                      <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder={t.admin.emailSubjectPlaceholder} maxLength={200} />
                    </div>

                    <div className="space-y-2">
                      <Label>{t.admin.emailBodyLabel}</Label>
                      <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder={t.admin.emailBodyPlaceholder} rows={6} maxLength={5000} />
                      <p className="text-xs text-muted-foreground">{emailBody.length}/5000 {t.admin.charsLabel}</p>
                    </div>

                    <div className="border rounded-xl p-4 bg-muted/20">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">{t.admin.broadcastWarning}</p>
                      </div>
                    </div>

                    <Button onClick={sendBroadcastEmail} disabled={sending || !emailSubject.trim() || !emailBody.trim()} className="w-full gap-2">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {t.admin.sendBroadcast}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            <TabsContent value="customization">
              <motion.div variants={fadeUp} initial="hidden" animate="visible">
                <CannedResponsesManager />
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </PageLayout>
  );
}
