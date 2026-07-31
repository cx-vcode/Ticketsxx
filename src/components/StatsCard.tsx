import { memo } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: "default" | "primary" | "accent" | "success" | "warning";
  delay?: number;
}

const variantStyles = {
  default: "bg-card border border-border/40",
  primary: "gradient-primary text-primary-foreground",
  accent: "gradient-brand text-accent-foreground",
  success: "bg-success text-success-foreground",
  warning: "bg-warning text-warning-foreground",
};

const iconVariantStyles = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary-foreground/15 text-primary-foreground",
  accent: "bg-accent-foreground/15 text-accent-foreground",
  success: "bg-success-foreground/15 text-success-foreground",
  warning: "bg-warning-foreground/15 text-warning-foreground",
};

export const StatsCard = memo(function StatsCard({ title, value, icon: Icon, trend, variant = "default", delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
      className={cn(
        "rounded-2xl p-5 shadow-card transition-shadow duration-300 hover:shadow-card-hover cursor-default",
        variantStyles[variant]
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={cn("text-sm font-medium", variant === "default" ? "text-muted-foreground" : "opacity-85")}>
            {title}
          </p>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: delay + 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mt-1 text-3xl font-bold"
          >
            {value}
          </motion.p>
          {trend && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.3 }}
              className={cn("mt-1 text-xs", variant === "default" ? "text-muted-foreground" : "opacity-75")}
            >
              {trend}
            </motion.p>
          )}
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: delay + 0.1, ease: [0.16, 1, 0.3, 1] }}
          className={cn("rounded-xl p-3", iconVariantStyles[variant])}
        >
          <Icon className="h-6 w-6" />
        </motion.div>
      </div>
    </motion.div>
  );
});
