import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Loader2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from '@/hooks/use-toast';

interface CSATWidgetProps {
  ticketId: string;
  ticketStatus: string;
  requesterId: string;
}

export function CSATWidget({ ticketId, ticketStatus, requesterId }: CSATWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedback, setFeedback] = useState('');

  const isRequester = user?.id === requesterId;
  const isResolved = ticketStatus === 'resolved' || ticketStatus === 'closed';

  const { data: existingRating, isLoading } = useQuery({
    queryKey: ['ticket-rating', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_ratings')
        .select('*')
        .eq('ticket_id', ticketId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ticketId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ticket_ratings').insert({
        ticket_id: ticketId,
        user_id: user!.id,
        rating,
        feedback: feedback.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-rating', ticketId] });
      toast({ title: 'شكراً لتقييمك! ✅' });
    },
    onError: () => toast({ title: 'حدث خطأ', variant: 'destructive' }),
  });

  if (!isResolved || !isRequester || isLoading) return null;

  const ratingLabels = ['', 'سيء جداً', 'سيء', 'مقبول', 'جيد', 'ممتاز'];

  if (existingRating) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="rounded-2xl border-success/20 bg-success/5">
          <CardContent className="pt-5 text-center">
            <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground mb-1">شكراً لتقييمك</p>
            <div className="flex justify-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-5 w-5 ${s <= existingRating.rating ? 'text-warning fill-warning' : 'text-muted'}`} />
              ))}
            </div>
            {existingRating.feedback && (
              <p className="text-xs text-muted-foreground mt-2">"{existingRating.feedback}"</p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="rounded-2xl border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <p className="text-sm font-bold text-foreground text-center mb-3">كيف تقيّم تجربتك؟</p>
          <div className="flex justify-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map(s => (
              <motion.button
                key={s}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating(s)}
                className="p-1"
              >
                <Star className={`h-7 w-7 transition-colors ${
                  s <= (hoveredStar || rating)
                    ? 'text-warning fill-warning'
                    : 'text-muted-foreground/30'
                }`} />
              </motion.button>
            ))}
          </div>
          <AnimatePresence>
            {rating > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <p className="text-xs text-center text-muted-foreground">{ratingLabels[rating]}</p>
                <Textarea
                  placeholder="أخبرنا المزيد عن تجربتك (اختياري)..."
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  className="rounded-xl text-xs min-h-[60px] resize-none"
                />
                <Button
                  className="w-full gradient-accent text-accent-foreground rounded-xl"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إرسال التقييم'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
