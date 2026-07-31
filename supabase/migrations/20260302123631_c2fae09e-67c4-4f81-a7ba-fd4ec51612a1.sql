
-- Fix the notifications insert policy to be more restrictive
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Users can insert notifications for related tickets" ON public.notifications 
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'agent') OR 
  public.has_role(auth.uid(), 'admin') OR 
  user_id = auth.uid()
);
