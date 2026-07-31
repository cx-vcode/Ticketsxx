import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Globe, Copy, CheckCircle, Code, Loader2, Send, Activity, Clock, Search, Terminal, FileJson } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, AdminTableSkeleton } from '@/components/common';
import { useLanguage } from '@/i18n';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-external-ticket`;

const examplePayload = {
  source_system: "ERP",
  title: "طلب صيانة نظام ERP",
  description: "يرجى إصلاح مشكلة في نظام الفوترة",
  priority: "high",
  requester_email: "user@example.com",
  requester_name: "أحمد محمد",
  external_reference: "ERP-INV-2024-001",
  service_name: "صيانة الأنظمة",
  category_name: "أعطال",
  external_payload: { invoice_id: "INV-001", module: "billing" }
};

const buildCurl = (url: string, payload: any, apiKey: string, externalKey: string) => `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -H "apikey: ${apiKey || 'YOUR_ANON_KEY'}"${externalKey ? ` \\\n  -H "x-api-key: ${externalKey}"` : ''} \\
  -d '${JSON.stringify(payload, null, 2)}'`;

const buildJs = (url: string, payload: any) => `// JavaScript / Node.js (fetch)
const res = await fetch("${url}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "apikey": process.env.SUPABASE_ANON_KEY,
    "x-api-key": process.env.EXTERNAL_API_KEY,
  },
  body: JSON.stringify(${JSON.stringify(payload, null, 2)}),
});
const data = await res.json();
console.log(data);`;

const buildPython = (url: string, payload: any) => `# Python (requests)
import requests, os, json

res = requests.post(
    "${url}",
    headers={
        "Content-Type": "application/json",
        "apikey": os.environ["SUPABASE_ANON_KEY"],
        "x-api-key": os.environ["EXTERNAL_API_KEY"],
    },
    data=json.dumps(${JSON.stringify(payload, null, 2)}),
)
print(res.json())`;

const buildPhp = (url: string, payload: any) => `<?php
// PHP (cURL)
$ch = curl_init("${url}");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "apikey: " . getenv("SUPABASE_ANON_KEY"),
        "x-api-key: " . getenv("EXTERNAL_API_KEY"),
    ],
    CURLOPT_POSTFIELDS => json_encode(${JSON.stringify(payload, null, 2)}),
]);
$response = curl_exec($ch);
echo $response;`;

const exampleResponse = {
  success: true,
  ticket: { id: "uuid-here", ticket_number: 1042, code: "TCK-2026-001042", status: "new", priority: "high", created_at: "2026-03-03T12:00:00.000Z" }
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'تم النسخ ✅' });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/70 rounded-xl p-4 text-xs overflow-x-auto border" dir="ltr"><code>{code}</code></pre>
      <Button variant="ghost" size="icon" className="absolute top-2 left-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleCopy}>
        {copied ? <CheckCircle className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export default function AdminExternalAPI() {
  const { lang } = useLanguage();
  const isAr = lang === 'ar';
  const dateLocale = isAr ? ar : enUS;
  const [activeTab, setActiveTab] = useState('docs');
  const [testPayload, setTestPayload] = useState(JSON.stringify(examplePayload, null, 2));
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [externalApiKey, setExternalApiKey] = useState('');

  // Fetch external tickets for logs
  const { data: externalTickets = [], isLoading: logsLoading } = useQuery({
    queryKey: ['external-tickets-log'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, ticket_number, code, title, source_system, status, priority, external_reference, created_at')
        .neq('source_system', 'PORTAL')
        .order('created_at', { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  // KPI stats
  const kpiStats = useMemo(() => {
    const total = externalTickets.length;
    const systems = new Set(externalTickets.map(t => t.source_system)).size;
    const today = externalTickets.filter(t => {
      const d = new Date(t.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, systems, today };
  }, [externalTickets]);

  const filteredLogs = useMemo(() => {
    if (!logSearch) return externalTickets;
    const q = logSearch.toLowerCase();
    return externalTickets.filter(t =>
      t.title?.toLowerCase().includes(q) ||
      t.code?.toLowerCase().includes(q) ||
      t.external_reference?.toLowerCase().includes(q) ||
      t.source_system?.toLowerCase().includes(q)
    );
  }, [externalTickets, logSearch]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    setTestStatus(null);
    setTestDuration(null);
    const start = Date.now();
    try {
      const payload = JSON.parse(testPayload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      };
      if (externalApiKey) headers['x-api-key'] = externalApiKey;
      const res = await fetch(API_BASE, { method: 'POST', headers, body: JSON.stringify(payload) });
      setTestStatus(res.status);
      const data = await res.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setTestResult(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setTestDuration(Date.now() - start);
      setTesting(false);
    }
  }, [testPayload, externalApiKey]);

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-600',
    open: 'bg-emerald-500/10 text-emerald-600',
    in_progress: 'bg-indigo-500/10 text-indigo-600',
    resolved: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
  };

  const fields = [
    ['source_system', 'string', '✅', isAr ? 'ERP | LMS | CPAY | PORTAL' : 'ERP | LMS | CPAY | PORTAL'],
    ['title', 'string', '✅', isAr ? 'عنوان التذكرة' : 'Ticket title'],
    ['description', 'string', '✅', isAr ? 'وصف المشكلة' : 'Issue description'],
    ['requester_email', 'string', '✅', isAr ? 'بريد مقدم الطلب' : 'Requester email'],
    ['priority', 'string', '❌', 'low | medium | high | urgent'],
    ['requester_name', 'string', '❌', isAr ? 'اسم مقدم الطلب' : 'Requester name'],
    ['external_reference', 'string', '❌', isAr ? 'رقم مرجعي' : 'External reference'],
    ['service_name', 'string', '❌', isAr ? 'اسم الخدمة' : 'Service name'],
    ['category_name', 'string', '❌', isAr ? 'اسم التصنيف' : 'Category name'],
    ['external_payload', 'object', '❌', isAr ? 'بيانات إضافية' : 'Extra data'],
  ];

  const livePayloadObj = useMemo(() => {
    try { return JSON.parse(testPayload); } catch { return examplePayload; }
  }, [testPayload]);

  return (
    <PageLayout>
      <PageHeader
        title={isAr ? 'واجهة API الخارجية' : 'External API'}
        icon={<Globe className="h-5 w-5" />}
      />
      <PageContainer maxWidth="lg">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isAr ? 'تذاكر خارجية' : 'External Tickets', value: kpiStats.total, icon: Activity, color: 'text-primary bg-primary/10' },
            { label: isAr ? 'أنظمة مصدر' : 'Source Systems', value: kpiStats.systems, icon: Globe, color: 'text-emerald-600 bg-emerald-500/10' },
            { label: isAr ? 'اليوم' : 'Today', value: kpiStats.today, icon: Clock, color: 'text-blue-600 bg-blue-500/10' },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="rounded-2xl border-border/50">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="docs" className="gap-1.5 rounded-lg text-xs"><Code className="h-3.5 w-3.5" />{isAr ? 'التوثيق' : 'Docs'}</TabsTrigger>
            <TabsTrigger value="test" className="gap-1.5 rounded-lg text-xs"><Send className="h-3.5 w-3.5" />{isAr ? 'اختبار' : 'Test'}</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5 rounded-lg text-xs"><Activity className="h-3.5 w-3.5" />{isAr ? 'السجل' : 'Logs'}</TabsTrigger>
          </TabsList>

          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-4 mt-4">
            <Card className="rounded-2xl border-primary/20 bg-primary/5">
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-5 w-5 text-primary" />
                  <h2 className="font-bold text-foreground">{isAr ? 'استقبال التذاكر من الأنظمة الخارجية' : 'Receive Tickets from External Systems'}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isAr ? 'يمكنك إرسال تذاكر من أي نظام خارجي (ERP, LMS, CPAY ...) عبر هذه الواجهة البرمجية الموحّدة.' : 'Send tickets from any external system (ERP, LMS, CPAY ...) via this unified API.'}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Code className="h-4 w-4 text-primary" />Endpoint</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-success/20 text-success text-xs font-bold px-2 py-1 rounded">POST</span>
                  <code className="text-xs bg-muted px-3 py-1.5 rounded-lg flex-1 overflow-x-auto" dir="ltr">{API_BASE}</code>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg gap-1.5" onClick={() => { navigator.clipboard.writeText(API_BASE); toast({ title: isAr ? 'تم النسخ ✅' : 'Copied ✅' }); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">{isAr ? 'الهيدرات المطلوبة:' : 'Required Headers:'}</p>
                  <div className="text-xs space-y-1 text-muted-foreground" dir="ltr">
                    <p><code className="bg-muted px-1.5 py-0.5 rounded">Content-Type: application/json</code></p>
                    <p><code className="bg-muted px-1.5 py-0.5 rounded">apikey: YOUR_ANON_KEY</code></p>
                    <p><code className="bg-muted px-1.5 py-0.5 rounded">x-api-key: YOUR_EXTERNAL_API_KEY</code> ({isAr ? 'اختياري' : 'optional'})</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  {isAr ? 'أمثلة كود (متعددة اللغات)' : 'Code Samples (Multi-language)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl" dir={isAr ? 'rtl' : 'ltr'}>
                  <TabsList className="rounded-xl mb-4 flex-wrap h-auto">
                    <TabsTrigger value="curl" className="rounded-lg text-xs">cURL</TabsTrigger>
                    <TabsTrigger value="js" className="rounded-lg text-xs">JavaScript</TabsTrigger>
                    <TabsTrigger value="python" className="rounded-lg text-xs">Python</TabsTrigger>
                    <TabsTrigger value="php" className="rounded-lg text-xs">PHP</TabsTrigger>
                    <TabsTrigger value="payload" className="rounded-lg text-xs"><FileJson className="h-3 w-3 ltr:mr-1 rtl:ml-1" />{isAr ? 'محتوى' : 'Payload'}</TabsTrigger>
                    <TabsTrigger value="response" className="rounded-lg text-xs">{isAr ? 'الاستجابة' : 'Response'}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl"><CodeBlock code={buildCurl(API_BASE, examplePayload, '$SUPABASE_ANON_KEY', '$EXTERNAL_API_KEY')} /></TabsContent>
                  <TabsContent value="js"><CodeBlock code={buildJs(API_BASE, examplePayload)} /></TabsContent>
                  <TabsContent value="python"><CodeBlock code={buildPython(API_BASE, examplePayload)} /></TabsContent>
                  <TabsContent value="php"><CodeBlock code={buildPhp(API_BASE, examplePayload)} /></TabsContent>
                  <TabsContent value="payload"><CodeBlock code={JSON.stringify(examplePayload, null, 2)} /></TabsContent>
                  <TabsContent value="response"><CodeBlock code={JSON.stringify(exampleResponse, null, 2)} /></TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-sm">{isAr ? 'مرجع الحقول' : 'Field Reference'}</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-start p-2 font-semibold">{isAr ? 'الحقل' : 'Field'}</th>
                        <th className="text-start p-2 font-semibold">{isAr ? 'النوع' : 'Type'}</th>
                        <th className="text-start p-2 font-semibold">{isAr ? 'مطلوب' : 'Required'}</th>
                        <th className="text-start p-2 font-semibold">{isAr ? 'الوصف' : 'Description'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(([field, type, required, desc]) => (
                        <tr key={field} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="p-2 font-mono" dir="ltr">{field}</td>
                          <td className="p-2">{type}</td>
                          <td className="p-2 text-center">{required}</td>
                          <td className="p-2">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Tab */}
          <TabsContent value="test" className="space-y-4 mt-4">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  {isAr ? 'اختبار الـ API التفاعلي' : 'Interactive API Tester'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAr ? 'مفتاح API الخارجي (اختياري)' : 'External API key (optional)'}</Label>
                    <Input dir="ltr" value={externalApiKey} onChange={e => setExternalApiKey(e.target.value)} placeholder="x-api-key value" className="h-9 rounded-xl text-xs font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{isAr ? 'الوجهة' : 'Endpoint'}</Label>
                    <Input dir="ltr" value={API_BASE} readOnly className="h-9 rounded-xl text-xs font-mono bg-muted/40" />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold mb-2 block">{isAr ? 'محتوى الطلب (JSON)' : 'Request Body (JSON)'}</Label>
                  <Textarea
                    value={testPayload}
                    onChange={e => setTestPayload(e.target.value)}
                    className="font-mono text-xs min-h-[220px] rounded-xl"
                    dir="ltr"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <Button onClick={handleTest} disabled={testing} className="gap-2 rounded-xl">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {isAr ? 'إرسال الطلب' : 'Send Request'}
                  </Button>
                  {testStatus !== null && (
                    <Badge variant={testStatus < 400 ? 'default' : 'destructive'} className="rounded-lg">
                      HTTP {testStatus}
                    </Badge>
                  )}
                  {testDuration !== null && (
                    <Badge variant="secondary" className="rounded-lg gap-1">
                      <Clock className="h-3 w-3" /> {testDuration}ms
                    </Badge>
                  )}
                </div>

                {testResult && (
                  <div>
                    <Label className="text-xs font-semibold mb-2 block">{isAr ? 'الاستجابة' : 'Response'}</Label>
                    <CodeBlock code={testResult} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Live cURL preview */}
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  {isAr ? 'معاينة cURL مباشرة' : 'Live cURL preview'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CodeBlock code={buildCurl(API_BASE, livePayloadObj, '$SUPABASE_ANON_KEY', externalApiKey || '$EXTERNAL_API_KEY')} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4 mt-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={logSearch} onChange={e => setLogSearch(e.target.value)} placeholder={isAr ? 'بحث في السجل...' : 'Search logs...'} className="ps-9 h-9 rounded-xl text-xs" />
              </div>
              <Badge variant="secondary" className="text-[10px] px-3 py-1 rounded-full">{filteredLogs.length} {isAr ? 'تذكرة' : 'tickets'}</Badge>
            </div>

            {logsLoading ? (
              <AdminTableSkeleton rows={5} />
            ) : filteredLogs.length === 0 ? (
              <EmptyState icon={Activity} variant="compact" title={isAr ? 'لا توجد تذاكر خارجية' : 'No external tickets'} />
            ) : (
              <Card className="rounded-2xl border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isAr ? 'الكود' : 'Code'}</TableHead>
                      <TableHead>{isAr ? 'العنوان' : 'Title'}</TableHead>
                      <TableHead className="text-center">{isAr ? 'النظام' : 'System'}</TableHead>
                      <TableHead className="text-center">{isAr ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead className="text-center">{isAr ? 'المرجع' : 'Ref'}</TableHead>
                      <TableHead>{isAr ? 'التاريخ' : 'Date'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(t => (
                      <TableRow key={t.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs">{t.code || `#${t.ticket_number}`}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">{t.title}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">{t.source_system}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[10px] px-2 py-0.5 border-0 ${statusColors[t.status] || 'bg-muted text-muted-foreground'}`}>{t.status}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">{t.external_reference || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: dateLocale })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageLayout>
  );
}

