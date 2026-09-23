-- =============================================
-- GiftListApp — Schema Patch
-- Run this in the Supabase SQL Editor
-- (use this instead of 001_initial_schema.sql)
-- =============================================

-- list_members: add role column if missing
ALTER TABLE public.list_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member'
  CHECK (role in ('owner', 'member'));

-- Add unique constraint to list_members if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.list_members'::regclass
      AND contype IN ('u','p')
      AND array_length(conkey, 1) = 2
  ) THEN
    ALTER TABLE public.list_members ADD UNIQUE (list_id, user_id);
  END IF;
END $$;

-- profiles: add updated_at if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES
-- =============================================

-- profiles
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view any profile" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- lists
DROP POLICY IF EXISTS "Owner can do everything with their list" ON public.lists;
DROP POLICY IF EXISTS "Members can view lists they joined" ON public.lists;
CREATE POLICY "Owner can do everything with their list" ON public.lists FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Members can view lists they joined" ON public.lists FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.list_members WHERE list_id = lists.id AND user_id = auth.uid())
);

-- list_members
DROP POLICY IF EXISTS "Members can view membership rows" ON public.list_members;
DROP POLICY IF EXISTS "Owner can manage members" ON public.list_members;
CREATE POLICY "Members can view membership rows" ON public.list_members FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND owner_id = auth.uid())
);
CREATE POLICY "Owner can manage members" ON public.list_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.lists WHERE id = list_id AND owner_id = auth.uid())
);

-- items
DROP POLICY IF EXISTS "List members can view items" ON public.items;
DROP POLICY IF EXISTS "List owner can manage items" ON public.items;
CREATE POLICY "List members can view items" ON public.items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.list_members WHERE list_id = items.list_id AND user_id = auth.uid())
);
CREATE POLICY "List owner can manage items" ON public.items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.lists WHERE id = items.list_id AND owner_id = auth.uid())
);

-- claims
DROP POLICY IF EXISTS "Non-owners can claim items" ON public.claims;
DROP POLICY IF EXISTS "Claimer can delete own claim" ON public.claims;
DROP POLICY IF EXISTS "Non-owners can view claims" ON public.claims;
CREATE POLICY "Non-owners can claim items" ON public.claims FOR INSERT WITH CHECK (
  auth.uid() = claimed_by AND auth.uid() != list_owner_id
);
CREATE POLICY "Claimer can delete own claim" ON public.claims FOR DELETE USING (auth.uid() = claimed_by);
CREATE POLICY "Non-owners can view claims" ON public.claims FOR SELECT USING (auth.uid() != list_owner_id);

-- feedback
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" ON public.feedback FOR INSERT WITH CHECK (true);

-- friends (existing table uses requester_id / addressee_id)
DROP POLICY IF EXISTS "Users can view their friend rows" ON public.friends;
DROP POLICY IF EXISTS "Users can send friend requests" ON public.friends;
DROP POLICY IF EXISTS "Recipient can accept or decline" ON public.friends;
DROP POLICY IF EXISTS "Either party can remove" ON public.friends;
CREATE POLICY "Users can view their friend rows" ON public.friends FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);
CREATE POLICY "Users can send friend requests" ON public.friends FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Recipient can accept or decline" ON public.friends FOR UPDATE USING (auth.uid() = addressee_id);
CREATE POLICY "Either party can remove" ON public.friends FOR DELETE USING (
  auth.uid() = requester_id OR auth.uid() = addressee_id
);

-- conversations
DROP POLICY IF EXISTS "Participants can view conversation" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can create a conversation" ON public.conversations;
CREATE POLICY "Participants can view conversation" ON public.conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = conversations.id AND user_id = auth.uid())
);
CREATE POLICY "Anyone can create a conversation" ON public.conversations FOR INSERT WITH CHECK (true);

-- conversation_participants
DROP POLICY IF EXISTS "Participants can view participant rows" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can insert themselves as participant" ON public.conversation_participants;
CREATE POLICY "Participants can view participant rows" ON public.conversation_participants FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp2
    WHERE cp2.conversation_id = conversation_participants.conversation_id AND cp2.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert themselves as participant" ON public.conversation_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

-- messages
DROP POLICY IF EXISTS "Participants can view messages" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.list_members (list_id, user_id, role)
  VALUES (new.id, new.owner_id, 'owner')
  ON CONFLICT (list_id, user_id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_list_created ON public.lists;
CREATE TRIGGER on_list_created
  AFTER INSERT ON public.lists
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

-- =============================================
-- join_list_by_code RPC
-- =============================================

DROP FUNCTION IF EXISTS public.join_list_by_code(text);
CREATE FUNCTION public.join_list_by_code(p_share_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- =============================================
-- REALTIME (skip if already added)
-- =============================================

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lists','list_members','items','claims','friends','messages','conversation_participants'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
