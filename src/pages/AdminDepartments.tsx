import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer } from '@/components/layout';
import { EmptyState, ErrorState, AdminTableSkeleton, SortableHead } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, Building2, Users, Ticket, Search, ArrowUpDown, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DeptStats {
  memberCount: number;
  ticketCount: number;
  openTickets: number;
}

export default function AdminDepartments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, isRTL, lang } = useLanguage();
  const isAr = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'name' | 'members' | 'tickets'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const { data: departments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  // Fetch profiles for member count per dept
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-dept-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, department_id, is_active');
      return data || [];
    },
  });

  // Fetch tickets for stats per dept
  const { data: tickets = [] } = useQuery({
    queryKey: ['tickets-dept-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('tickets').select('id, department_id, status');
      return data || [];
    },
  });

  const deptStatsMap = useMemo(() => {
    const map: Record<string, DeptStats> = {};
    departments.forEach(d => {
      const members = profiles.filter((p: any) => p.department_id === d.id && p.is_active);
      const deptTickets = tickets.filter((t: any) => t.department_id === d.id);
      const openT = deptTickets.filter((t: any) => !['closed', 'resolved'].includes(t.status));
      map[d.id] = { memberCount: members.length, ticketCount: deptTickets.length, openTickets: openT.length };
    });
    return map;
  }, [departments, profiles, tickets]);

  // KPIs
  const kpiStats = useMemo(() => ({
    totalDepts: departments.length,
    totalMembers: profiles.filter((p: any) => p.is_active && p.department_id).length,
    totalTickets: tickets.length,
    openTickets: tickets.filter((t: any) => !['closed', 'resolved'].includes(t.status)).length,
  }), [departments, profiles, tickets]);

  // Filtered & sorted
  const filteredDepts = useMemo(() => {
    let result = departments.filter(d =>
      !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.description?.toLowerCase().includes(search.toLowerCase())
    );
    result.sort((a, b) => {
      if (sortField === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const statsA = deptStatsMap[a.id] || { memberCount: 0, ticketCount: 0 };
      const statsB = deptStatsMap[b.id] || { memberCount: 0, ticketCount: 0 };
      const valA = sortField === 'members' ? statsA.memberCount : statsA.ticketCount;
      const valB = sortField === 'members' ? statsB.memberCount : statsB.ticketCount;
      return sortAsc ? valA - valB : valB - valA;
    });
    return result;
  }, [departments, search, sortField, sortAsc, deptStatsMap]);

  const createMut = useMutation({
    mutationFn: () => createDepartment({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); toast({ title: t.admin.deptCreated }); resetForm(); },
  });

  const updateMut = useMutation({
    mutationFn: () => updateDepartment(editId!, { name: name.trim(), description: description.trim() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); toast({ title: t.admin.deptUpdated }); resetForm(); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['departments'] }); toast({ title: t.admin.deptDeleted }); setDeleteTarget(null); },
  });

  const resetForm = () => { setName(''); setDescription(''); setEditId(null); setOpen(false); };

  const startEdit = (dept: any) => {
    setEditId(dept.id);
    setName(dept.name);
    setDescription(dept.description || '');
    setOpen(true);
  };

  const toggleSort = (field: 'name' | 'members' | 'tickets') => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const handleExportCSV = useCallback(() => {
    const headers = isAr
      ? ['القسم', 'الوصف', 'عدد الأعضاء', 'إجمالي التذاكر', 'التذاكر المفتوحة']
      : ['Department', 'Description', 'Members', 'Total Tickets', 'Open Tickets'];
    const rows = filteredDepts.map(d => {
      const s = deptStatsMap[d.id] || { memberCount: 0, ticketCount: 0, openTickets: 0 };
      return [d.name, d.description || '', s.memberCount, s.ticketCount, s.openTickets];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `departments_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast({ title: isAr ? 'تم التصدير ✅' : 'Exported ✅' });
  }, [filteredDepts, deptStatsMap, isAr, toast]);

  const kpiCards = [
    { label: isAr ? 'الأقسام' : 'Departments', value: kpiStats.totalDepts, icon: Building2, color: 'text-primary bg-primary/10' },
    { label: isAr ? 'الأعضاء النشطون' : 'Active Members', value: kpiStats.totalMembers, icon: Users, color: 'text-emerald-600 bg-emerald-500/10' },
    { label: isAr ? 'إجمالي التذاكر' : 'Total Tickets', value: kpiStats.totalTickets, icon: Ticket, color: 'text-blue-600 bg-blue-500/10' },
    { label: isAr ? 'تذاكر مفتوحة' : 'Open Tickets', value: kpiStats.openTickets, icon: Ticket, color: 'text-warning bg-warning/10' },
  ];

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.deptManagement}
        icon={<Building2 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button className="gradient-accent text-accent-foreground gap-2 text-sm shadow-lg shadow-primary/20 rounded-xl" onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="h-4 w-4" /> {t.admin.newDept}
            </Button>
          </div>
        }
      />
      <PageContainer maxWidth="lg">
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {kpiCards.map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={isAr ? 'بحث في الأقسام...' : 'Search departments...'} className="ps-9 h-10 md:h-9 rounded-xl text-sm" aria-label={isAr ? 'بحث' : 'Search'} />
            </div>
            <Badge variant="secondary" className="text-[10px] px-3 py-1 rounded-full">
              {filteredDepts.length} {isAr ? 'قسم' : 'depts'}
            </Badge>
          </div>

          {/* Table */}
          {isLoading ? (
            <AdminTableSkeleton rows={6} cols={5} showKpis={false} showToolbar={false} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : filteredDepts.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={search ? (isAr ? 'لا توجد نتائج' : 'No results') : t.admin.noDepts}
              description={search ? (isAr ? 'حاول البحث بكلمة مختلفة.' : 'Try a different search.') : (isAr ? 'ابدأ بإنشاء أول قسم.' : 'Create your first department.')}
            />
          ) : (
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead active={sortField === 'name'} direction={sortAsc ? 'asc' : 'desc'} onSort={() => toggleSort('name')}>
                      {isAr ? 'القسم' : 'Department'}
                    </SortableHead>
                    <TableHead>{isAr ? 'الوصف' : 'Description'}</TableHead>
                    <SortableHead active={sortField === 'members'} direction={sortAsc ? 'asc' : 'desc'} onSort={() => toggleSort('members')} align="center">
                      <Users className="h-3 w-3" />
                      {isAr ? 'الأعضاء' : 'Members'}
                    </SortableHead>
                    <SortableHead active={sortField === 'tickets'} direction={sortAsc ? 'asc' : 'desc'} onSort={() => toggleSort('tickets')} align="center">
                      <Ticket className="h-3 w-3" />
                      {isAr ? 'التذاكر' : 'Tickets'}
                    </SortableHead>
                    <TableHead className="text-center">{isAr ? 'مفتوحة' : 'Open'}</TableHead>
                    <TableHead className="w-24 text-center">{isAr ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepts.map(dept => {
                    const stats = deptStatsMap[dept.id] || { memberCount: 0, ticketCount: 0, openTickets: 0 };
                    return (
                      <TableRow key={dept.id} className="group hover:bg-muted/30">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-semibold text-foreground">{dept.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{dept.description || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-full">{stats.memberCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">{stats.ticketCount}</TableCell>
                        <TableCell className="text-center">
                          {stats.openTickets > 0 ? (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-warning/10 text-warning border-0">{stats.openTickets}</Badge>
                          ) : <span className="text-muted-foreground text-xs">0</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" aria-label={isAr ? 'تعديل' : 'Edit'} className="h-9 w-9 rounded-lg" onClick={() => startEdit(dept)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={isAr ? 'حذف' : 'Delete'} className="h-9 w-9 rounded-lg" onClick={() => setDeleteTarget(dept)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </PageContainer>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{editId ? t.admin.editDept : t.admin.createDept}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{t.admin.deptName}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t.admin.deptNamePlaceholder} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t.admin.deptDesc}</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.admin.deptDescPlaceholder} className="rounded-xl" />
            </div>
            <Button
              className="w-full gradient-accent text-accent-foreground rounded-xl"
              disabled={!name.trim() || createMut.isPending || updateMut.isPending}
              onClick={() => editId ? updateMut.mutate() : createMut.mutate()}
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}
              {editId ? t.common.update : t.common.create}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isAr ? 'حذف القسم' : 'Delete Department'}</AlertDialogTitle>
            <AlertDialogDescription>
              {isAr ? `هل أنت متأكد من حذف قسم "${deleteTarget?.name}"؟` : `Are you sure you want to delete "${deleteTarget?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
