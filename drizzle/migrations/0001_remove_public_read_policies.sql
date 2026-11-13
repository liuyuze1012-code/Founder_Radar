DO $$ DECLARE t text; BEGIN
FOREACH t IN ARRAY ARRAY['theses','scans','items','people','person_items','evidence','picks','cases'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS "Anyone can read" ON public.%I', t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
END LOOP; END $$;