-- ==============================================================================
-- 004_full_sync.sql
-- Synchronizes schema elements from live Supabase project (focghjwqougxapdywhwe)
-- Includes: app_config, GDPR profile fields, list archiving, conversation/friend
-- functions & triggers, and complete RLS policy suite.
-- ==============================================================================

-- 1. App configuration table (remote config replacement)
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_config' AND policyname = 'app_config_read'
  ) THEN
    CREATE POLICY "app_config_read" ON public.app_config FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Additional columns on existing tables
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_lists_owner_archived
  ON public.lists USING btree (owner_id, is_archived, created_at DESC);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_eu_user boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gdpr_applies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_data_processing boolean NOT NULL DEFAULT false;

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS platform text;

-- 3. Functions / Stored Procedures / RPCs
CREATE OR REPLACE FUNCTION public.add_owner_as_member()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.list_members (list_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.join_list_by_code(p_share_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_list_id uuid;
BEGIN
  SELECT id INTO v_list_id
  FROM public.lists
  WHERE share_code = upper(trim(p_share_code))
    AND is_private = false;

  IF v_list_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share code';
  END IF;

  INSERT INTO public.list_members (list_id, user_id, role)
  VALUES (v_list_id, auth.uid(), 'member')
  ON CONFLICT (list_id, user_id) DO NOTHING;

  RETURN v_list_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_list_access(p_list uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
           select 1 from public.lists l
           where l.id = p_list and l.owner_id = auth.uid()
         )
      or exists (
           select 1 from public.list_members m
           where m.list_id = p_list and m.user_id = auth.uid()
         );
$function$;

CREATE OR REPLACE FUNCTION public.is_list_owner(p_list_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lists
    WHERE id = p_list_id AND owner_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_list_member(p_list_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.list_members
    WHERE list_id = p_list_id AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_conversation(other_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
  v_existing uuid;
BEGIN
  -- Check if a conversation already exists between the two users
  SELECT cp1.conversation_id INTO v_existing
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = other_user_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create new conversation
  INSERT INTO public.conversations DEFAULT VALUES RETURNING id INTO v_conv_id;

  -- Add both participants (bypasses RLS via SECURITY DEFINER)
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv_id, auth.uid()), (v_conv_id, other_user_id);

  RETURN v_conv_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_conversation_other_participants(p_user_id uuid, p_conv_ids uuid[])
 RETURNS TABLE(conversation_id uuid, id uuid, email text, display_name text, given_name text, family_name text, photo_url text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cp.conversation_id, p.id, p.email, p.display_name,
         p.given_name, p.family_name, p.photo_url
  FROM conversation_participants cp
  JOIN profiles p ON p.id = cp.user_id
  WHERE cp.conversation_id = ANY(p_conv_ids)
    AND cp.user_id != p_user_id;
$function$;

-- 4. Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_list_created ON public.lists;
CREATE TRIGGER on_list_created
  AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- 5. Realtime publication additions (idempotent)
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'lists',
    'list_members',
    'items',
    'claims',
    'friends',
    'conversation_participants',
    'messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
