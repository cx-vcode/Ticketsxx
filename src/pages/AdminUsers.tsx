import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAllUsers, updateUserRole, fetchSystems, fetchServices, fetchDepartments, AppRole } from '@/lib/api';
import { supabase } from '@/integrations/supabase/client';
import { PageLayout, PageHeader, PageContainer, SectionHeader } from '@/components/layout';
import { EmptyState, ErrorState, AdminTableSkeleton, SortableHead } from '@/components/common';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { sanitizeError } from '@/lib/errorHandler';
import { Loader2, Users, UserPlus, Settings2, X, Pencil, Trash2, Search, UserCheck, UserX, ShieldCheck, Download, Filter, ArrowUpDown, ChevronUp, ChevronDown, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/i18n';
import { useLocalizedLabels } from '@/hooks/useLocalizedLabels';
import { format, subDays, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';

const roles: AppRole[] = ['requester', 'agent', 'developer', 'admin'];

type SortField = 'full_name' | 'email' | 'role' | 'created_at' | 'is_active';
type SortDir = 'asc' | 'desc';

export default function AdminUsers() {
  const { t, isRTL, lang } = useLanguage();
  const { roleLabels } = useLocalizedLabels();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [selectedDev, setSelectedDev] = useState<any>(null);
  const [editUser, setEditUser] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('requester');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPhone, setEditPhone] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editEmployeeNumber, setEditEmployeeNumber] = useState('');
  const [editManagerId, setEditManagerId] = useState('');

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['all-users'],
    queryFn: fetchAllUsers,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: fetchDepartments,
  });

  const { data: systems = [] } = useQuery({
    queryKey: ['systems'],
    queryFn: fetchSystems,
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => fetchServices(),
  });

  const { data: devAccess = [], refetch: refetchAccess } = useQuery({
    queryKey: ['developer-access-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('developer_access')
        .select('*, systems(name, code), services(name)');
      return data || [];
    },
  });

  // KPI Stats
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u: any) => u.is_active !== false).length;
    const inactive = total - active;
    const recentCount = users.filter((u: any) => isAfter(new Date(u.created_at), subDays(new Date(), 30))).length;
    const byRole: Record<string, number> = {};
    roles.forEach(r => { byRole[r] = users.filter((u: any) => u.role === r).length; });
    return { total, active, inactive, recentCount, byRole };
  }, [users]);

  // Filter & Sort
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Text search
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((u: any) =>
        u.full_name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.job_title?.toLowerCase().includes(s) ||
        u.employee_number?.toLowerCase().includes(s)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      result = result.filter((u: any) => u.role === filterRole);
    }

    // Department filter
    if (filterDept !== 'all') {
      if (filterDept === 'none') {
        result = result.filter((u: any) => !u.department_id);
      } else {
        result = result.filter((u: any) => u.department_id === filterDept);
      }
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter((u: any) => filterStatus === 'active' ? u.is_active !== false : u.is_active === false);
    }

    // Sort
    result.sort((a: any, b: any) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';
      if (sortField === 'is_active') {
        valA = a.is_active !== false ? 1 : 0;
        valB = b.is_active !== false ? 1 : 0;
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [users, search, filterRole, filterDept, filterStatus, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const activeFiltersCount = [filterRole !== 'all', filterDept !== 'all', filterStatus !== 'all'].filter(Boolean).length;

  // Export CSV
  const exportCSV = () => {
    const isAr = lang === 'ar';
    const headers = isAr
      ? ['الاسم', 'البريد', 'الدور', 'الوظيفة', 'القسم', 'الحالة', 'الهاتف', 'الجوال', 'رقم الموظف', 'تاريخ الإنشاء']
      : ['Name', 'Email', 'Role', 'Job Title', 'Department', 'Status', 'Phone', 'Mobile', 'Employee #', 'Created'];

    const rows = filteredUsers.map((u: any) => {
      const dept = departments.find(d => d.id === u.department_id);
      return [
        u.full_name || '',
        u.email || '',
        roleLabels[u.role as AppRole] || u.role,
        u.job_title || '',
        dept?.name || '',
        u.is_active !== false ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Inactive'),
        u.phone || '',
        u.mobile || '',
        u.employee_number || '',
        u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd') : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const bom = '\uFEFF';
    const csv = bom + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: isAr ? 'تم تصدير الملف ✅' : 'File exported ✅' });
  };

  const roleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: AppRole }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      toast({ title: t.admin.roleUpdated });
    },
    onError: (err: any) => {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    },
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast({ title: t.admin.allFieldsRequired, variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: t.admin.passwordMinLength, variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: {
          action: 'create', email: newEmail.trim(), password: newPassword, full_name: newName.trim(),
          role: newRole, job_title: newJobTitle.trim() || null,
          phone: newPhone.trim() || null, mobile: newMobile.trim() || null,
          employee_number: newEmployeeNumber.trim() || null,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: t.admin.userCreated });
      setOpen(false);
      setNewName(''); setNewEmail(''); setNewPassword(''); setNewRole('requester');
      setNewJobTitle(''); setNewPhone(''); setNewMobile(''); setNewEmployeeNumber('');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (err: any) {
      toast({ title: t.admin.userCreateError, description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const openEditDialog = (user: any) => {
    setEditUser(user);
    setEditName(user.full_name || '');
    setEditEmail(user.email || '');
    setEditJobTitle(user.job_title || '');
    setEditDeptId(user.department_id || '');
    setEditActive(user.is_active !== false);
    setEditPhone(user.phone || '');
    setEditMobile(user.mobile || '');
    setEditCity(user.city || '');
    setEditCountry(user.country || '');
    setEditEmployeeNumber(user.employee_number || '');
    setEditManagerId(user.manager_id || '');
    setEditOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: {
          action: 'update',
          user_id: editUser.id,
          full_name: editName.trim(),
          email: editEmail.trim() !== editUser.email ? editEmail.trim() : undefined,
          job_title: editJobTitle.trim() || null,
          department_id: editDeptId || null,
          is_active: editActive,
          phone: editPhone.trim() || null,
          mobile: editMobile.trim() || null,
          city: editCity.trim() || null,
          country: editCountry.trim() || null,
          employee_number: editEmployeeNumber.trim() || null,
          manager_id: editManagerId || null,
        },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: t.admin.userUpdated });
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (err: any) {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const res = await supabase.functions.invoke('create-user', {
        body: { action: 'delete', user_id: userId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast({ title: t.admin.userDeleted });
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (err: any) {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    }
  };

  const handleSendResetLink = async (user: any) => {
    if (!user?.email) {
      toast({ title: t.common.error, description: 'No email', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: t.auth.sendResetLink,
        description: `${t.auth.forgotPasswordDesc} → ${user.email}`,
      });
    } catch (err: any) {
      toast({ title: t.common.error, description: sanitizeError(err), variant: 'destructive' });
    }
  };

  const openAccessDialog = (user: any) => {
    setSelectedDev(user);
    setAccessOpen(true);
  };

  const devAccessForUser = (userId: string) => devAccess.filter((a: any) => a.developer_id === userId);

  const toggleSystemAccess = async (devId: string, systemId: string) => {
    const existing = devAccess.find((a: any) => a.developer_id === devId && a.system_id === systemId && !a.service_id);
    if (existing) {
      await supabase.from('developer_access').delete().eq('id', existing.id);
    } else {
      await supabase.from('developer_access').insert({ developer_id: devId, system_id: systemId });
    }
    refetchAccess();
  };

  const toggleServiceAccess = async (devId: string, serviceId: string) => {
    const existing = devAccess.find((a: any) => a.developer_id === devId && a.service_id === serviceId);
    if (existing) {
      await supabase.from('developer_access').delete().eq('id', existing.id);
    } else {
      await supabase.from('developer_access').insert({ developer_id: devId, service_id: serviceId });
    }
    refetchAccess();
  };

  const clearAllAccess = async (devId: string) => {
    await supabase.from('developer_access').delete().eq('developer_id', devId);
    refetchAccess();
    toast({ title: t.admin.allAccessCleared });
  };

  const isAr = lang === 'ar';

  const kpiCards = [
    {
      label: isAr ? 'إجمالي المستخدمين' : 'Total Users',
      value: stats.total,
      icon: Users,
      color: 'text-primary bg-primary/10',
    },
    {
      label: isAr ? 'المستخدمين النشطين' : 'Active Users',
      value: stats.active,
      icon: UserCheck,
      color: 'text-emerald-600 bg-emerald-500/10',
    },
    {
      label: isAr ? 'المستخدمين المعطلين' : 'Inactive Users',
      value: stats.inactive,
      icon: UserX,
      color: 'text-destructive bg-destructive/10',
    },
    {
      label: isAr ? 'مضافين حديثاً (30 يوم)' : 'Added Recently (30d)',
      value: stats.recentCount,
      icon: UserPlus,
      color: 'text-blue-600 bg-blue-500/10',
    },
  ];

  const getDeptName = (deptId: string | null) => {
    if (!deptId) return isAr ? 'غير محدد' : 'Unassigned';
    return departments.find(d => d.id === deptId)?.name || '-';
  };

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.userManagement}
        icon={<Users className="h-5 w-5" />}
        badge={<Badge variant="secondary" className="text-xs">{users.length}</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={exportCSV}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-xl">
                  <UserPlus className="h-4 w-4" />
                  {t.admin.newUser}
                </Button>
              </DialogTrigger>
              <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-lg max-h-[85vh] overflow-auto">
                <DialogHeader><DialogTitle>{t.admin.createNewUser}</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t.admin.fullName}</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t.admin.fullNamePlaceholder} required /></div>
                    <div><Label>{t.admin.jobTitleLabel}</Label><Input value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} placeholder={t.admin.jobTitlePlaceholder} /></div>
                  </div>
                  <div><Label>{t.admin.emailRequired}</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" required dir="ltr" /></div>
                  <div><Label>{t.admin.passwordRequired}</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="6+" required dir="ltr" minLength={6} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t.admin.phoneLabel}</Label><Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+966 1x xxx xxxx" dir="ltr" /></div>
                    <div><Label>{t.admin.mobileLabel}</Label><Input value={newMobile} onChange={e => setNewMobile(e.target.value)} placeholder="+966 5x xxx xxxx" dir="ltr" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t.admin.employeeNumberLabel}</Label><Input value={newEmployeeNumber} onChange={e => setNewEmployeeNumber(e.target.value)} placeholder="EMP-001" /></div>
                    <div><Label>{t.admin.roleLabel}</Label>
                      <Select value={newRole} onValueChange={v => setNewRole(v as AppRole)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}{t.admin.createUser}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <PageContainer maxWidth="xl">
        <div className="space-y-6">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {kpiCards.map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="rounded-2xl border-border/50">
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.color} shrink-0`}>
                      <kpi.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Role Distribution Mini Badges */}
          <div className="flex flex-wrap gap-2">
            {roles.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => { setFilterRole(filterRole === r ? 'all' : r); setShowFilters(true); }}
                aria-pressed={filterRole === r}
                aria-label={`${roleLabels[r]}: ${stats.byRole[r] || 0}`}
                className="inline-flex items-center gap-1.5 min-h-[32px] py-1 px-2.5 text-xs rounded-full border border-border bg-background hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 data-[active=true]:bg-primary/10 data-[active=true]:border-primary/30"
                data-active={filterRole === r}
              >
                <ShieldCheck className="h-3 w-3" />
                {roleLabels[r]}: {stats.byRole[r] || 0}
              </button>
            ))}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.admin.searchByNameEmailJob} className={isRTL ? 'pr-10' : 'pl-10'} />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl shrink-0" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-4 w-4" />
              {isAr ? 'فلترة' : 'Filters'}
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
              <Card className="rounded-2xl border-border/50">
                <CardContent className="py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5 block">{isAr ? 'الدور' : 'Role'}</Label>
                      <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
                          {roles.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">{isAr ? 'القسم' : 'Department'}</Label>
                      <Select value={filterDept} onValueChange={setFilterDept}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
                          <SelectItem value="none">{isAr ? 'بدون قسم' : 'Unassigned'}</SelectItem>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5 block">{isAr ? 'الحالة' : 'Status'}</Label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{isAr ? 'الكل' : 'All'}</SelectItem>
                          <SelectItem value="active">{isAr ? 'نشط' : 'Active'}</SelectItem>
                          <SelectItem value="inactive">{isAr ? 'معطّل' : 'Inactive'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {activeFiltersCount > 0 && (
                    <Button variant="ghost" size="sm" className="mt-3 text-xs gap-1" onClick={() => { setFilterRole('all'); setFilterDept('all'); setFilterStatus('all'); }}>
                      <X className="h-3 w-3" />
                      {isAr ? 'مسح الفلاتر' : 'Clear Filters'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {isAr ? `عرض ${filteredUsers.length} من ${users.length} مستخدم` : `Showing ${filteredUsers.length} of ${users.length} users`}
            </p>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <AdminTableSkeleton rows={8} cols={6} showKpis={false} showToolbar={false} />
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search || activeFiltersCount > 0 ? t.common.noResults : t.admin.noUsers}
              description={search || activeFiltersCount > 0
                ? (isAr ? 'حاول تغيير البحث أو مسح الفلاتر.' : 'Try a different search or clear filters.')
                : (isAr ? 'أنشئ أول مستخدم في النظام.' : 'Create your first user.')}
            />
          ) : (
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <SortableHead active={sortField === 'full_name'} direction={sortDir} onSort={() => toggleSort('full_name')}>
                      {isAr ? 'المستخدم' : 'User'}
                    </SortableHead>
                    <SortableHead active={sortField === 'email'} direction={sortDir} onSort={() => toggleSort('email')} className="hidden md:table-cell">
                      {isAr ? 'البريد' : 'Email'}
                    </SortableHead>
                    <SortableHead active={sortField === 'role'} direction={sortDir} onSort={() => toggleSort('role')}>
                      {isAr ? 'الدور' : 'Role'}
                    </SortableHead>
                    <TableHead className="hidden lg:table-cell">{isAr ? 'القسم' : 'Dept'}</TableHead>
                    <SortableHead active={sortField === 'is_active'} direction={sortDir} onSort={() => toggleSort('is_active')} className="hidden sm:table-cell">
                      {isAr ? 'الحالة' : 'Status'}
                    </SortableHead>
                    <SortableHead active={sortField === 'created_at'} direction={sortDir} onSort={() => toggleSort('created_at')} className="hidden lg:table-cell">
                      {isAr ? 'تاريخ الإنشاء' : 'Created'}
                    </SortableHead>
                    <TableHead className="text-center">{isAr ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u: any) => (
                    <TableRow key={u.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary shrink-0">
                            {u.full_name?.charAt(0) || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{u.full_name || t.admin.noName}</p>
                            {u.job_title && <p className="text-[11px] text-muted-foreground truncate">{u.job_title}</p>}
                            <p className="text-[11px] text-muted-foreground truncate md:hidden">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]" dir="ltr">{u.email}</p>
                      </TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={v => roleMut.mutate({ userId: u.id, role: v as AppRole })}>
                          <SelectTrigger aria-label={isAr ? 'دور المستخدم' : 'User role'} className="w-28 h-9 text-xs rounded-lg border-border/50"><SelectValue /></SelectTrigger>
                          <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{getDeptName(u.department_id)}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.is_active !== false ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            {isAr ? 'نشط' : 'Active'}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            {isAr ? 'معطّل' : 'Inactive'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy', { locale: isAr ? ar : undefined }) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {u.role === 'developer' && (
                            <Button variant="ghost" size="icon" aria-label={t.admin.devPermissions} className="h-9 w-9 rounded-lg md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity" onClick={() => openAccessDialog(u)} title={t.admin.devPermissions}>
                              <Settings2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" aria-label={t.common.edit} className="h-9 w-9 rounded-lg md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity" onClick={() => openEditDialog(u)} title={t.common.edit}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t.auth.sendResetLink} className="h-9 w-9 rounded-lg md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity" title={t.auth.sendResetLink}>
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.auth.sendResetLink}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t.auth.forgotPasswordDesc} <span dir="ltr" className="font-mono">{u.email}</span>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleSendResetLink(u)}>
                                  {t.auth.sendResetLink}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={t.common.delete} className="h-9 w-9 rounded-lg text-destructive hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity" title={t.common.delete}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t.admin.deleteUser}</AlertDialogTitle>
                                <AlertDialogDescription>{t.admin.deleteUserConfirm}</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="gap-2">
                                <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDeleteUser(u.id)}>
                                  {t.common.delete}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </PageContainer>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-lg max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>{t.admin.editUser}</DialogTitle></DialogHeader>
          {editUser && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.admin.fullName}</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div><Label>{t.admin.emailRequired}</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} dir="ltr" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.admin.jobTitleLabel}</Label><Input value={editJobTitle} onChange={e => setEditJobTitle(e.target.value)} placeholder={t.admin.jobTitlePlaceholder} /></div>
                <div><Label>{t.admin.employeeNumberLabel}</Label><Input value={editEmployeeNumber} onChange={e => setEditEmployeeNumber(e.target.value)} placeholder="EMP-001" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.admin.phoneLabel}</Label><Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="+966 1x xxx xxxx" dir="ltr" /></div>
                <div><Label>{t.admin.mobileLabel}</Label><Input value={editMobile} onChange={e => setEditMobile(e.target.value)} placeholder="+966 5x xxx xxxx" dir="ltr" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.admin.cityLabel}</Label><Input value={editCity} onChange={e => setEditCity(e.target.value)} /></div>
                <div><Label>{t.admin.countryLabel}</Label><Input value={editCountry} onChange={e => setEditCountry(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t.admin.departmentLabel}</Label>
                  <Select value={editDeptId} onValueChange={setEditDeptId}>
                    <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.common.none}</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t.admin.managerLabel}</Label>
                  <Select value={editManagerId} onValueChange={setEditManagerId}>
                    <SelectTrigger><SelectValue placeholder={t.common.none} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t.common.none}</SelectItem>
                      {users.filter((u: any) => u.id !== editUser?.id).map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>{t.admin.activeStatus}</Label>
                <Switch checked={editActive} onCheckedChange={setEditActive} />
              </div>
              <Button className="w-full" onClick={handleUpdateUser} disabled={saving}>
                {saving && <Loader2 className={`h-4 w-4 animate-spin ${isRTL ? 'ml-2' : 'mr-2'}`} />}{t.common.saveChanges}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Developer Access Dialog */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              {t.admin.devAccessTitle}: {selectedDev?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selectedDev && (
            <div className="space-y-4 mt-2 max-h-[60vh] overflow-auto">
              <p className="text-xs text-muted-foreground">
                {t.admin.devAccessDesc}
              </p>
              {devAccessForUser(selectedDev.id).length > 0 && (
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => clearAllAccess(selectedDev.id)}>
                  <X className="h-3 w-3" />{t.admin.clearAllAccess}
                </Button>
              )}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">{t.admin.systemAccess}</Label>
                {systems.map(sys => {
                  const checked = devAccess.some((a: any) => a.developer_id === selectedDev.id && a.system_id === sys.id && !a.service_id);
                  return (
                    <div key={sys.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                      <Checkbox checked={checked} onCheckedChange={() => toggleSystemAccess(selectedDev.id, sys.id)} />
                      <div><p className="text-sm font-medium">{sys.name}</p><p className="text-xs text-muted-foreground">{sys.code}</p></div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-3">
                <Label className="text-sm font-semibold">{t.admin.serviceAccess}</Label>
                {services.map(svc => {
                  const checked = devAccess.some((a: any) => a.developer_id === selectedDev.id && a.service_id === svc.id);
                  return (
                    <div key={svc.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                      <Checkbox checked={checked} onCheckedChange={() => toggleServiceAccess(selectedDev.id, svc.id)} />
                      <div><p className="text-sm font-medium">{svc.name}</p><p className="text-xs text-muted-foreground">{svc.systems?.name || ''}</p></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
