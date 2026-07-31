
-- Service custom fields (Form Builder)
CREATE TABLE public.service_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text', -- text, number, select, textarea
  options JSONB DEFAULT '[]'::jsonb, -- for select type: ["option1","option2"]
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ticket field values
CREATE TABLE public.ticket_field_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.service_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, field_id)
);

-- Enable RLS
ALTER TABLE public.service_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_field_values ENABLE ROW LEVEL SECURITY;

-- service_fields policies
CREATE POLICY "Admins can manage service fields"
ON public.service_fields FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone authenticated can view service fields"
ON public.service_fields FOR SELECT
USING (true);

-- ticket_field_values policies
CREATE POLICY "Anyone authenticated can view field values"
ON public.ticket_field_values FOR SELECT
USING (true);

CREATE POLICY "Users can insert field values for own tickets"
ON public.ticket_field_values FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_id AND requester_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'agent')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Agents and admins can update field values"
ON public.ticket_field_values FOR UPDATE
USING (
  public.has_role(auth.uid(), 'agent')
  OR public.has_role(auth.uid(), 'admin')
);
