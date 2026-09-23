-- =============================================
-- Item image storage
-- =============================================
-- Bucket for gift-item photos uploaded from AddItemScreen. Images are
-- moderated for NSFW content by the `moderate-and-upload-image` Edge
-- Function BEFORE they ever reach this bucket (see
-- supabase/functions/moderate-and-upload-image/index.ts) — the function
-- uploads using the service_role key, which bypasses RLS entirely.
--
-- Business rule: regular clients (anon/authenticated) must NEVER be able to
-- write to this bucket directly. If they could, someone could upload an
-- image straight to storage and skip the moderation check, or set
-- `image_uri` on an item to point at content that was never checked. The
-- only INSERT/UPDATE/DELETE path into this bucket is the service_role
-- (i.e. the Edge Function), so no policy is created for those operations —
-- Postgres RLS defaults to deny when no policy grants an action, and
-- service_role bypasses RLS altogether.
--
-- Public SELECT is intentional: item photos are just product images (not
-- sensitive data), and a public bucket lets the CDN serve them directly via
-- a stable public URL stored in items.image_uri, without needing signed
-- URLs refreshed on every list view.
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

create policy "Public can view item images"
  on storage.objects for select
  using (bucket_id = 'item-images');
