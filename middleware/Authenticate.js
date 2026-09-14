import { getSupabaseForUser } from '../config/supabaseclient.js';

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('No token in header');
    return res.sendStatus(401);
  }

  const supabaseUser = getSupabaseForUser(token);
  const { data, error } = await supabaseUser.auth.getUser(token);

  if (error || !data.user) {
    console.log('getUser failed:', error?.message, error?.status);
    return res.sendStatus(401);
  }

  req.user = data.user;
  req.token = token;
  req.supabase = supabaseUser;
  next();
}
