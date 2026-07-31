import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Shield, UserCircle } from 'lucide-react';

const roleIcons: Record<string, any> = { owner: Crown, admin: Shield, member: UserCircle };
const roleColors: Record<string, string> = {
  owner: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  admin: 'bg-primary/10 text-primary border-primary/20',
  member: 'bg-muted text-muted-foreground border-border',
};

export function TenantMembersPanel({ tenantId, isAr }: { tenantId: string; isAr: boolean }) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['tenant-members', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_members')
        .select('id, role, user_id, joined_at')
        .eq('tenant_id', tenantId);
      if (error) throw error;

      // Fetch profile info for each member
      if (!data?.length) return [];
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      return data.map(m => ({
        ...m,
        profile: profiles?.find(p => p.id === m.user_id),
      }));
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />)}</div>;
  }

  if (!members.length) {
    return (
      <div className="text-center py-6">
        <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">{isAr ? 'لا يوجد أعضاء' : 'No members'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {members.length} {isAr ? 'عضو' : 'member(s)'}
      </p>
      {members.map((m: any) => {
        const Icon = roleIcons[m.role] || UserCircle;
        return (
          <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
              {m.profile?.full_name?.charAt(0) || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{m.profile?.full_name || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground truncate">{m.profile?.email}</p>
            </div>
            <Badge variant="outline" className={`text-[9px] ${roleColors[m.role] || ''}`}>
              <Icon className="h-2.5 w-2.5 me-0.5" />
              {m.role}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
