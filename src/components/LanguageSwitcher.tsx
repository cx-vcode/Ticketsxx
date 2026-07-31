import { useLanguage, Language } from '@/i18n';
import { useContext } from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  size?: 'default' | 'icon';
  variant?: 'ghost' | 'outline';
}

export function LanguageSwitcher({ size = 'icon', variant = 'ghost' }: Props) {
  const { lang, setLanguage, t } = useLanguage();

  const toggle = async () => {
    const next: Language = lang === 'ar' ? 'en' : 'ar';
    setLanguage(next);
    
    // Save to database if user is logged in (check session directly)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase
        .from('profiles')
        .update({ preferred_language: next })
        .eq('id', session.user.id);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={toggle}
          className="gap-1.5 text-xs"
        >
          <Globe className="h-4 w-4" />
          {size !== 'icon' && (lang === 'ar' ? 'EN' : 'عربي')}
          {size === 'icon' && <span className="sr-only">{t.language.switchLanguage}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={lang === 'ar' ? 'left' : 'right'}>
        {lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      </TooltipContent>
    </Tooltip>
  );
}
