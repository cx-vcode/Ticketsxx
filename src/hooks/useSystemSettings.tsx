import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SystemSettingsState {
  system_name: string;
  system_subtitle: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  loading: boolean;
  refetch: () => Promise<void>;
}

const defaults = {
  system_name: 'Ticket-X',
  system_subtitle: 'SMART HELPDESK',
  primary_color: '217 71% 35%',
  accent_color: '210 80% 52%',
  logo_url: '',
};

const SystemSettingsContext = createContext<SystemSettingsState>({
  ...defaults,
  loading: true,
  refetch: async () => {},
});

function applyThemeColors(primary: string, accent: string) {
  const root = document.documentElement;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--sidebar-ring', primary);
}

export function SystemSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    const { data } = await supabase.from('system_settings').select('key, value');
    if (data) {
      const s = { ...defaults };
      data.forEach((row: any) => {
        if (row.key in s) (s as any)[row.key] = row.value || (defaults as any)[row.key];
      });
      setSettings(s);
      // Apply colors only if they differ from defaults
      applyThemeColors(s.primary_color, s.accent_color);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SystemSettingsContext.Provider value={{ ...settings, loading, refetch: fetchSettings }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export const useSystemSettings = () => useContext(SystemSettingsContext);
