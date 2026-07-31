import { useState, useEffect, useRef } from 'react';
import { PageLayout, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Palette, Type, Image, Save, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { CannedResponsesManager } from '@/components/CannedResponses';
import { motion } from 'framer-motion';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { useLanguage } from '@/i18n';

interface SettingsForm {
  system_name: string;
  system_subtitle: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
}

const defaultSettings: SettingsForm = {
  system_name: 'Ticket-X',
  system_subtitle: 'SMART HELPDESK',
  primary_color: '24 95% 53%',
  accent_color: '340 75% 55%',
  logo_url: '',
};

function hslToHex(hsl: string): string {
  const parts = hsl.split(' ');
  if (parts.length !== 3) return '#3b82f6';
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function AdminSettings() {
  const systemSettings = useSystemSettings();
  const { t, isRTL } = useLanguage();
  const [settings, setSettings] = useState<SettingsForm>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presetThemes = [
    { name: t.admin.themeNavyBlue, primary: '217 72% 50%', accent: '217 72% 55%' },
    { name: t.admin.themeEmeraldGreen, primary: '152 55% 42%', accent: '152 55% 48%' },
    { name: t.admin.themeRoyalPurple, primary: '262 60% 50%', accent: '262 60% 56%' },
    { name: t.admin.themeWarmOrange, primary: '24 80% 50%', accent: '24 80% 56%' },
    { name: t.admin.themeCrimsonRed, primary: '345 60% 42%', accent: '345 60% 48%' },
    { name: t.admin.themeTurquoise, primary: '180 55% 42%', accent: '180 55% 48%' },
  ];

  useEffect(() => {
    if (!systemSettings.loading) {
      setSettings({
        system_name: systemSettings.system_name,
        system_subtitle: systemSettings.system_subtitle,
        primary_color: systemSettings.primary_color,
        accent_color: systemSettings.accent_color,
        logo_url: systemSettings.logo_url,
      });
      setLoading(false);
    }
  }, [systemSettings.loading]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t.admin.imageFileRequired);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t.admin.fileSizeLimit);
      return;
    }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `logo-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('system-assets').upload(filePath, file, { upsert: true });
    if (error) {
      toast.error(t.admin.logoUploadError);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('system-assets').getPublicUrl(filePath);
    setSettings(prev => ({ ...prev, logo_url: urlData.publicUrl }));
    toast.success(t.admin.logoUploaded);
    setUploading(false);
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(settings);
      for (const [key, value] of entries) {
        await supabase
          .from('system_settings')
          .update({ value: value || null, updated_at: new Date().toISOString() })
          .eq('key', key);
      }
      await systemSettings.refetch();
      toast.success(t.admin.settingsSaved);
    } catch {
      toast.error(t.admin.settingsSaveError);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--ring');
    root.style.removeProperty('--sidebar-primary');
    root.style.removeProperty('--sidebar-ring');
    toast.info(t.admin.settingsReset);
  };

  const applyPreset = (primary: string, accent: string) => {
    setSettings(prev => ({ ...prev, primary_color: primary, accent_color: accent }));
    const root = document.documentElement;
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--sidebar-primary', primary);
    root.style.setProperty('--sidebar-ring', primary);
  };

  if (loading) return null;

  return (
    <PageLayout>
      <PageHeader
        title={t.admin.systemSettings}
        icon={<Settings className="h-4 w-4" />}
      />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                  <Settings className="h-6 w-6 text-primary" />
                  {t.admin.systemSettings}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t.admin.systemSettingsDesc}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} size="sm">
                  <RotateCcw className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {t.admin.resetDefaults}
                </Button>
                <Button onClick={handleSave} disabled={saving} size="sm">
                  <Save className={`h-4 w-4 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                  {saving ? t.admin.saving : t.common.save}
                </Button>
              </div>
            </div>

            {/* System Identity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Type className="h-5 w-5 text-primary" />
                  {t.admin.systemIdentity}
                </CardTitle>
                <CardDescription>{t.admin.systemIdentityDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.systemName}</Label>
                    <Input
                      value={settings.system_name}
                      onChange={e => setSettings(prev => ({ ...prev, system_name: e.target.value }))}
                      placeholder={t.admin.systemNamePlaceholder}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.subtitle}</Label>
                    <Input
                      value={settings.system_subtitle}
                      onChange={e => setSettings(prev => ({ ...prev, system_subtitle: e.target.value }))}
                      placeholder={t.admin.subtitlePlaceholder}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Image className="h-5 w-5 text-primary" />
                  {t.admin.logoTitle}
                </CardTitle>
                <CardDescription>{t.admin.logoDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1"
                    >
                      <Upload className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                      {uploading ? t.admin.uploading : t.admin.uploadLogo}
                    </Button>
                    {settings.logo_url && (
                      <Button variant="outline" size="icon" onClick={handleRemoveLogo} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">{t.admin.uploadDirectLink}</div>
                  <Input
                    value={settings.logo_url}
                    onChange={e => setSettings(prev => ({ ...prev, logo_url: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    dir="ltr"
                  />
                </div>

                {settings.logo_url && (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">{t.common.preview}:</span>
                    <img src={settings.logo_url} alt="Logo preview" className="h-16 w-16 object-contain rounded" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Theme Colors */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Palette className="h-5 w-5 text-primary" />
                  {t.admin.themeColors}
                </CardTitle>
                <CardDescription>{t.admin.themeColorsDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="mb-3 block">{t.admin.presetThemes}</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {presetThemes.map(theme => (
                      <button
                        key={theme.name}
                        onClick={() => applyPreset(theme.primary, theme.accent)}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md ${
                          settings.primary_color === theme.primary
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="h-8 w-8 rounded-full shrink-0 shadow-sm" style={{ background: `hsl(${theme.primary})` }} />
                        <span className="text-sm font-medium text-foreground">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t.admin.primaryColor}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={hslToHex(settings.primary_color)}
                        onChange={e => {
                          const hsl = hexToHsl(e.target.value);
                          setSettings(prev => ({ ...prev, primary_color: hsl }));
                          document.documentElement.style.setProperty('--primary', hsl);
                          document.documentElement.style.setProperty('--ring', hsl);
                          document.documentElement.style.setProperty('--sidebar-primary', hsl);
                        }}
                        className="h-10 w-14 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={settings.primary_color}
                        onChange={e => setSettings(prev => ({ ...prev, primary_color: e.target.value }))}
                        className="font-mono text-xs"
                        dir="ltr"
                        placeholder="217 72% 50%"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t.admin.accentColor}</Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={hslToHex(settings.accent_color)}
                        onChange={e => {
                          const hsl = hexToHsl(e.target.value);
                          setSettings(prev => ({ ...prev, accent_color: hsl }));
                          document.documentElement.style.setProperty('--accent', hsl);
                          document.documentElement.style.setProperty('--sidebar-ring', hsl);
                        }}
                        className="h-10 w-14 rounded cursor-pointer border border-border"
                      />
                      <Input
                        value={settings.accent_color}
                        onChange={e => setSettings(prev => ({ ...prev, accent_color: e.target.value }))}
                        className="font-mono text-xs"
                        dir="ltr"
                        placeholder="217 72% 55%"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg space-y-3">
                  <Label className="text-muted-foreground">{t.admin.livePreview}</Label>
                  <div className="flex flex-wrap gap-3">
                    <Button size="sm">{t.admin.primaryBtn}</Button>
                    <Button size="sm" variant="secondary">{t.admin.secondaryBtn}</Button>
                    <Button size="sm" variant="outline">{t.admin.outlineBtn}</Button>
                    <Button size="sm" variant="destructive">{t.admin.deleteBtn}</Button>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded" style={{ background: `hsl(${settings.primary_color})` }} />
                    <div className="h-8 w-8 rounded" style={{ background: `hsl(${settings.accent_color})` }} />
                    <div className="h-8 flex-1 rounded bg-card border border-border" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Canned Responses Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <CannedResponsesManager />
          </motion.div>
      </main>
    </PageLayout>
  );
}
