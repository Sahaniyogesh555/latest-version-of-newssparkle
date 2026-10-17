
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- Re-asserted even though CREATE OR REPLACE keeps the ACL: this file must be
-- safe on its own if it is ever the one that runs.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated, service_role;
