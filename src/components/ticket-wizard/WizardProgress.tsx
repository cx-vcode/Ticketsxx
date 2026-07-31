import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n';

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface WizardProgressProps {
  steps: Step[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  const { isRTL } = useLanguage();

  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto mb-8">
      {steps.map((step, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.15 : 1,
                  backgroundColor: isCompleted
                    ? 'hsl(var(--primary))'
                    : isCurrent
                    ? 'hsl(var(--accent))'
                    : 'hsl(var(--muted))',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm',
                  (isCompleted || isCurrent) ? 'text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : step.icon}
              </motion.div>
              <span className={cn(
                'text-xs font-medium whitespace-nowrap',
                isCurrent ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 h-0.5 rounded-full bg-muted overflow-hidden self-start mt-5">
                <motion.div
                  initial={false}
                  animate={{ scaleX: isCompleted ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className={cn("h-full bg-primary", isRTL ? "origin-right" : "origin-left")}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
