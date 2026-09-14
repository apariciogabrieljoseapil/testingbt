import { Router } from 'express';
import { getSupabaseForUser } from '../config/supabaseclient.js';
import { renderProfileHtml } from '../utils/profiletemplate.js';

const router = Router();

router.get('/profile/:id', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    console.log('No token in query string');
    return res.status(401).send('<h1>Unauthorized</h1>');
  }

  const supabaseUser = getSupabaseForUser(token);
  const { data: userData, error: authError } = await supabaseUser.auth.getUser(token);

  if (authError || !userData.user) {
    console.log('getUser failed:', authError?.message);
    return res.status(401).send('<h1>Unauthorized</h1>');
  }

  if (userData.user.id !== req.params.id) {
    return res.status(403).send('<h1>Forbidden</h1>');
  }

  const { data, error } = await supabaseUser
    .from('costumer_account_information')
    .select('*')
    .eq('costumer_id', req.params.id)
    .single();

  if (error || !data) return res.status(404).send('<h1>Not found</h1>');

  const bucketName = 'costumer_account_profile';

  if (data.avatar_url) {
    const path = new URL(data.avatar_url).pathname;
    const result = path.split(`/${bucketName}/`)[1];

    const { data: signedData, error: signError } = await supabaseUser.storage
      .from(bucketName)
      .createSignedUrl(result, 3600); // valid for 1 hour

    if (signError) {
      console.error('Signed URL error:', signError);
      data.avatar_url = null;
    } else {
      data.avatar_url = signedData.signedUrl;
    }
  }

  res.send(renderProfileHtml(data));
});

export default router;
