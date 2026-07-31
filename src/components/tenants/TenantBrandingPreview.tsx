import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Palette, Save } from 'lucide-react';

interface Props {
  tenant: any;
  onUpdate: (data: Record<string, any>) => void;
  isUpdating: boolean;
  isAr: boolean;
}

export function TenantBrandingPreview({ tenant, onUpdate, isUpdating, isAr }: Props) {
  const [primary, setPrimary] = useState(tenant.primary_color || '#6366f1');
  const [accent, setAccent] = useState(tenant.accent_color || '#8b5cf6');
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url || '');

  const handleSave = () => {
    onUpdate({ primary_color: primary, accent_color: accent, logo_url: logoUrl || null });
  };

  return (
    <div className="space-y-4">
      {/* Live Preview */}
      <div className="rounded-xl border overflow-hidden">
        <div className="h-10 flex items-center px-3 gap-2" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-6 w-6 rounded object-contain bg-white/20" />
          ) : (
            <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center text-white text-[10px] font-bold">
              {tenant.name?.charAt(0)}
            </div>
          )}
          <span className="text-white text-xs font-bold truncate">{tenant.name}</span>
        </div>
        <div className="p-3 bg-background space-y-2">
          <div className="h-2 rounded-full w-3/4" style={{ backgroundColor: primary, opacity: 0.2 }} />
          <div className="h-2 rounded-full w-1/2" style={{ backgroundColor: accent, opacity: 0.15 }} />
          <div className="flex gap-2 mt-2">
            <div className="h-6 px-3 rounded-lg text-[10px] text-white font-bold flex items-center" style={{ backgroundColor: primary }}>
              {isAr ? 'زر أساسي' : 'Primary'}
            </div>
            <div className="h-6 px-3 rounded-lg text-[10px] text-white font-bold flex items-center" style={{ backgroundColor: accent }}>
              {isAr ? 'زر ثانوي' : 'Accent'}
            </div>
          </div>
        </div>
      </div>

      {/* Color Pickers */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px]">{isAr ? 'اللون الأساسي' : 'Primary'}</Label>
          <div className="flex gap-1.5">
            <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            <Input value={primary} onChange={e => setPrimary(e.target.value)} className="rounded-lg text-xs h-8" dir="ltr" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">{isAr ? 'لون التمييز' : 'Accent'}</Label>
          <div className="flex gap-1.5">
            <input type="color" value={accent} onChange={e => setAccent(e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
            <Input value={accent} onChange={e => setAccent(e.target.value)} className="rounded-lg text-xs h-8" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Logo URL */}
      <div className="space-y-1.5">
        <Label className="text-[11px]">{isAr ? 'رابط الشعار' : 'Logo URL'}</Label>
        <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="rounded-lg text-xs h-8" dir="ltr" placeholder="https://..." />
      </div>

      <Button size="sm" className="w-full rounded-xl gap-2" onClick={handleSave} disabled={isUpdating}>
        <Save className="h-3.5 w-3.5" />
        {isAr ? 'حفظ التغييرات' : 'Save Changes'}
      </Button>
    </div>
  );
}
