// create-list: ports functions/src/createList.ts
// Creates a list for the calling user, generating a unique share code when
// sharable. Uniqueness is enforced by the `lists.share_code` unique constraint;
// on a collision (Postgres error 23505) we retry with a new code.
import { customAlphabet } from 'nanoid';
import { corsHeaders, json, preflight } from '../_shared/cors.ts';
import { adminClient, getUser } from '../_shared/supabase.ts';

const nano = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 7);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const user = await getUser(req);
  if (!user) return json({ error: 'You must be logged in to create a list.' }, 401);

  const { title, isSharable } = await req.json().catch(() => ({}));
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return json({ error: 'A non-empty list title is required.' }, 400);
  }

  const db = adminClient();
  const base = {
    owner_id: user.id,
    title: title.trim(),
    is_private: !isSharable,
  };

  // Non-sharable: single insert, no share code.
  if (!isSharable) {
    const { data, error } = await db.from('lists').insert(base).select('id').single();
    if (error) return json({ error: error.message }, 500);
    return new Response(JSON.stringify({ listId: data.id, shareCode: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Sharable: retry on unique-violation until a free code is found.
  for (let attempt = 0; attempt < 5; attempt++) {
    const shareCode = nano();
    const { data, error } = await db
      .from('lists')
      .insert({ ...base, share_code: shareCode })
      .select('id')
      .single();

    if (!error) {
      return new Response(
        JSON.stringify({ listId: data.id, shareCode }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // 23505 = unique_violation -> collision, retry. Anything else is fatal.
    if ((error as { code?: string }).code !== '23505') {
      return json({ error: error.message }, 500);
    }
  }

  return json({ error: 'Failed to generate a unique share code. Please try again.' }, 500);
});
