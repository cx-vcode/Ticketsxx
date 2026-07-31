import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSystems, fetchServices, fetchServiceCategories,
  createSystem, updateSystem, deleteSystem,
  createService, updateService, deleteService,
  createServiceCategory, deleteServiceCategory,
  fetchDepartments, fetchSLAPolicies,
  System, Service, ServiceCategory,
} from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, Server, FolderOpen, Tag, Pencil, TicketCheck, Monitor, BookOpen, CreditCard, GraduationCap, Users, ShoppingBag, LayoutDashboard, Wrench } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { ServicesMissingGroupPanel } from '@/components/services/ServicesMissingGroupPanel';

const pageVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

const systemIcons: Record<string, React.ReactNode> = {
  ERP: <Monitor className="h-4 w-4 text-primary-foreground" />,
  LMS: <BookOpen className="h-4 w-4 text-primary-foreground" />,
  CPAY: <CreditCard className="h-4 w-4 text-primary-foreground" />,
  SIS: <GraduationCap className="h-4 w-4 text-primary-foreground" />,
  HR: <Users className="h-4 w-4 text-primary-foreground" />,
  EDUMALLS: <ShoppingBag className="h-4 w-4 text-primary-foreground" />,
  DASHBOARD: <LayoutDashboard className="h-4 w-4 text-primary-foreground" />,
  SMART_SCHOOL: <GraduationCap className="h-4 w-4 text-primary-foreground" />,
};

export default function AdminServiceCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, isRTL } = useLanguage();
  const { priorityLabels: localizedPriority } = useLocalizedLabels();

  const { data: systems = [] } = useQuery({ queryKey: ['systems'], queryFn: fetchSystems });
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: () => fetchServices() });
  const { data: categories = [] } = useQuery({ queryKey: ['service-categories'], queryFn: () => fetchServiceCategories() });
  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: slaPolicies = [] } = useQuery({ queryKey: ['sla-policies'], queryFn: fetchSLAPolicies });

  // Ticket stats per service
  const { data: ticketStats = [] } = useQuery({
    queryKey: ['service-ticket-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('service_id, status');
      if (error) throw error;
      return data || [];
    },
  });

  const getServiceStats = (serviceId: string) => {
    const svcTickets = ticketStats.filter(t => t.service_id === serviceId);
    const open = svcTickets.filter(t => !['closed', 'resolved'].includes(t.status)).length;
    const closed = svcTickets.filter(t => ['closed', 'resolved'].includes(t.status)).length;
    return { open, closed, total: svcTickets.length };
  };

  const getSystemStats = (systemId: string) => {
    const svcIds = services.filter(s => s.system_id === systemId).map(s => s.id);
    const sysTickets = ticketStats.filter(t => t.service_id && svcIds.includes(t.service_id));
    const open = sysTickets.filter(t => !['closed', 'resolved'].includes(t.status)).length;
    const closed = sysTickets.filter(t => ['closed', 'resolved'].includes(t.status)).length;
    return { open, closed, total: sysTickets.length };
  };

  // System CRUD
  const [sysOpen, setSysOpen] = useState(false);
  const [editingSys, setEditingSys] = useState<System | null>(null);
  const [sysCode, setSysCode] = useState('');
  const [sysName, setSysName] = useState('');
  const [sysDesc, setSysDesc] = useState('');

  const openEditSystem = (sys: System) => {
    setEditingSys(sys);
    setSysCode(sys.code);
    setSysName(sys.name);
    setSysDesc(sys.description || '');
    setSysOpen(true);
  };

  const openNewSystem = () => {
    setEditingSys(null);
    setSysCode('');
    setSysName('');
    setSysDesc('');
    setSysOpen(true);
  };

  const createSysMut = useMutation({
    mutationFn: () => createSystem({ code: sysCode.trim().toUpperCase(), name: sysName.trim(), description: sysDesc.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      toast({ title: t.admin.systemCreated });
      setSysOpen(false);
    },
  });

  const updateSysMut = useMutation({
    mutationFn: () => updateSystem(editingSys!.id, { code: sysCode.trim().toUpperCase(), name: sysName.trim(), description: sysDesc.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      toast({ title: t.admin.systemUpdated });
      setSysOpen(false);
    },
  });

  const deleteSysMut = useMutation({
    mutationFn: deleteSystem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: t.admin.systemDeleted });
    },
  });

  // Service CRUD
  const [svcOpen, setSvcOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcSystemId, setSvcSystemId] = useState('');
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDept, setSvcDept] = useState('');
  const [svcSla, setSvcSla] = useState('');

  const openEditService = (svc: Service) => {
    setEditingSvc(svc);
    setSvcSystemId(svc.system_id);
    setSvcName(svc.name);
    setSvcDesc(svc.description || '');
    setSvcDept(svc.default_assignment_group || '');
    setSvcSla(svc.sla_policy_id || '');
    setSvcOpen(true);
  };

  const openNewService = (systemId?: string) => {
    setEditingSvc(null);
    setSvcSystemId(systemId || '');
    setSvcName('');
    setSvcDesc('');
    setSvcDept('');
    setSvcSla('');
    setSvcOpen(true);
  };

  const createSvcMut = useMutation({
    mutationFn: () => createService({
      system_id: svcSystemId,
      name: svcName.trim(),
      description: svcDesc.trim() || undefined,
      default_assignment_group: svcDept || undefined,
      sla_policy_id: svcSla || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: t.admin.serviceCreated });
      setSvcOpen(false);
    },
  });

  const updateSvcMut = useMutation({
    mutationFn: () => updateService(editingSvc!.id, {
      system_id: svcSystemId,
      name: svcName.trim(),
      description: svcDesc.trim() || null,
      default_assignment_group: svcDept || null,
      sla_policy_id: svcSla || null,
    } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: t.admin.serviceUpdated });
      setSvcOpen(false);
    },
  });

  const deleteSvcMut = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast({ title: t.admin.serviceDeleted });
    },
  });

  // Category CRUD
  const [catOpen, setCatOpen] = useState(false);
  const [catServiceId, setCatServiceId] = useState('');
  const [catName, setCatName] = useState('');

  const createCatMut = useMutation({
    mutationFn: () => createServiceCategory({ service_id: catServiceId, name: catName.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({ title: t.admin.categoryCreated });
      setCatOpen(false);
      setCatName('');
      setCatServiceId('');
    },
  });

  const deleteCatMut = useMutation({
    mutationFn: deleteServiceCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-categories'] });
      toast({ title: t.admin.categoryDeleted });
    },
  });

  const handleSaveSystem = () => {
    if (editingSys) updateSysMut.mutate();
    else createSysMut.mutate();
  };

  const handleSaveService = () => {
    if (editingSvc) updateSvcMut.mutate();
    else createSvcMut.mutate();
  };

  const isSysSaving = createSysMut.isPending || updateSysMut.isPending;
  const isSvcSaving = createSvcMut.isPending || updateSvcMut.isPending;

  const headerActions = (
    <>
      <Button size="sm" variant="outline" className="gap-1 text-xs rounded-lg" onClick={openNewSystem}>
        <Plus className="h-3.5 w-3.5" /> {t.admin.addSystem}
      </Button>
      <Button size="sm" className="gradient-accent text-accent-foreground gap-1 text-xs shadow-sm rounded-lg" onClick={() => openNewService()}>
        <Plus className="h-3.5 w-3.5" /> {t.admin.addService}
      </Button>
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="gap-1 text-xs rounded-lg">
            <Plus className="h-3.5 w-3.5" /> {t.admin.addCategory}
          </Button>
        </DialogTrigger>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{t.admin.newCategory}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.admin.forService} *</Label>
              <Select value={catServiceId} onValueChange={setCatServiceId}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder={t.tickets.selectService} /></SelectTrigger>
                <SelectContent>
                  {services.map(s => <SelectItem key={s.id} value={s.id}>{s.systems?.name} → {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.admin.categoryName} *</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} className="rounded-lg" />
            </div>
            <Button className="w-full gradient-accent text-accent-foreground rounded-lg" disabled={!catServiceId || !catName.trim() || createCatMut.isPending} onClick={() => createCatMut.mutate()}>
              {createCatMut.isPending && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
              {t.common.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.serviceCatalogTitle}
        actions={headerActions}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
            <motion.div variants={pageVariants} initial="hidden" animate="visible" className="max-w-5xl mx-auto">
              <ServicesMissingGroupPanel isAr={isRTL} />
              {systems.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>{t.admin.noSystems}</p>
                </div>
              ) : (
                <Accordion type="multiple" className="space-y-3">
                  {systems.map((system) => {
                    const sysServices = services.filter(s => s.system_id === system.id);
                    const sysStats = getSystemStats(system.id);
                    const icon = systemIcons[system.code] || <Server className="h-4 w-4 text-primary-foreground" />;
                    return (
                      <motion.div key={system.id} variants={fadeUp}>
                        <AccordionItem value={system.id} className="border rounded-2xl bg-card border-border/50 shadow-card overflow-hidden">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shrink-0">
                                {icon}
                              </div>
                              <div className="flex flex-col items-start min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">{system.name}</span>
                                  <span className="text-xs text-muted-foreground">({system.code})</span>
                                </div>
                                {system.description && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[300px]">{system.description}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ms-auto me-2">
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <FolderOpen className="h-3 w-3" /> {sysServices.length} {t.admin.services}
                                </Badge>
                                {sysStats.total > 0 && (
                                  <>
                                    <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
                                      <TicketCheck className="h-3 w-3" /> {sysStats.closed}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                                      {sysStats.open} {t.admin.openTickets}
                                    </Badge>
                                  </>
                                )}
                                <Button
                                  variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                                  onClick={(e) => { e.stopPropagation(); openEditSystem(system); }}
                                >
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={e => e.stopPropagation()}>
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
                                      <AlertDialogDescription>{t.admin.deleteSystemConfirm}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteSysMut.mutate(system.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                        {t.common.delete}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            {sysServices.length === 0 ? (
                              <div className="text-center py-6">
                                <p className="text-sm text-muted-foreground mb-2">{t.admin.noServices}</p>
                                <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => openNewService(system.id)}>
                                  <Plus className="h-3.5 w-3.5" /> {t.admin.addService}
                                </Button>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {sysServices.map(svc => {
                                  const svcCats = categories.filter(c => c.service_id === svc.id);
                                  const stats = getServiceStats(svc.id);
                                  return (
                                    <Card key={svc.id} className="border-dashed rounded-xl">
                                      <CardContent className="py-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <FolderOpen className="h-4 w-4 text-accent shrink-0" />
                                            <div className="min-w-0">
                                              <span className="font-medium text-sm">{svc.name}</span>
                                              {svc.description && (
                                                <p className="text-xs text-muted-foreground truncate max-w-[400px]">{svc.description}</p>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            {stats.total > 0 && (
                                              <div className="flex items-center gap-1.5 me-2">
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
                                                  {stats.open}
                                                </Badge>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
                                                  {stats.closed}
                                                </Badge>
                                              </div>
                                            )}
                                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => openEditService(svc)}>
                                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                            </Button>
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>{t.common.confirm}</AlertDialogTitle>
                                                  <AlertDialogDescription>{t.admin.deleteServiceConfirm}</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => deleteSvcMut.mutate(svc.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    {t.common.delete}
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>
                                          </div>
                                        </div>
                                        <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                                          {svc.departments?.name && <span>{t.admin.assignToDept}: {svc.departments.name}</span>}
                                        </div>
                                        {svcCats.length > 0 && (
                                          <div className="flex flex-wrap gap-1.5 mt-1">
                                            {svcCats.map(cat => (
                                              <span key={cat.id} className="inline-flex items-center gap-1 text-xs bg-muted px-2.5 py-1 rounded-lg">
                                                <Tag className="h-3 w-3" />
                                                {cat.name}
                                                <button onClick={() => deleteCatMut.mutate(cat.id)} className="hover:text-destructive transition-colors">×</button>
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                                <Button size="sm" variant="ghost" className="w-full rounded-xl gap-1 text-xs text-muted-foreground" onClick={() => openNewService(system.id)}>
                                  <Plus className="h-3.5 w-3.5" /> {t.admin.addService}
                                </Button>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </motion.div>
                    );
                  })}
                </Accordion>
              )}
            </motion.div>
      </main>

      {/* System Dialog */}
      <Dialog open={sysOpen} onOpenChange={setSysOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingSys ? t.admin.editSystem : t.admin.newSystem}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.admin.systemCode} *</Label>
              <Input value={sysCode} onChange={e => setSysCode(e.target.value)} placeholder="ERP" className="rounded-xl font-mono" />
            </div>
            <div className="space-y-2">
              <Label>{t.admin.systemName} *</Label>
              <Input value={sysName} onChange={e => setSysName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t.admin.systemDescription}</Label>
              <Textarea value={sysDesc} onChange={e => setSysDesc(e.target.value)} className="rounded-xl resize-none" rows={3} />
            </div>
            <Button className="w-full gradient-accent text-accent-foreground rounded-xl" disabled={!sysCode.trim() || !sysName.trim() || isSysSaving} onClick={handleSaveSystem}>
              {isSysSaving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
              {editingSys ? t.common.saveChanges : t.common.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={svcOpen} onOpenChange={setSvcOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editingSvc ? t.admin.editService : t.admin.newService}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.newTicket.selectSystem} *</Label>
              <Select value={svcSystemId} onValueChange={setSvcSystemId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t.newTicket.selectSystem} /></SelectTrigger>
                <SelectContent>
                  {systems.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.admin.serviceName} *</Label>
              <Input value={svcName} onChange={e => setSvcName(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t.admin.serviceDescription}</Label>
              <Textarea value={svcDesc} onChange={e => setSvcDesc(e.target.value)} className="rounded-xl resize-none" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>{t.admin.assignToDept}</Label>
              <Select value={svcDept} onValueChange={setSvcDept}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t.admin.departmentLabel} /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.admin.slaPolicy}</Label>
              <Select value={svcSla} onValueChange={setSvcSla}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder={t.admin.slaPolicy} /></SelectTrigger>
                <SelectContent>
                  {slaPolicies.map(p => <SelectItem key={p.id} value={p.id}>{localizedPriority[p.priority]} ({p.first_response_minutes}m / {p.resolution_minutes}m)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full gradient-accent text-accent-foreground rounded-xl" disabled={!svcSystemId || !svcName.trim() || isSvcSaving} onClick={handleSaveService}>
              {isSvcSaving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
              {editingSvc ? t.common.saveChanges : t.common.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
