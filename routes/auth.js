import { Router } from 'express';
import { supabase } from '../config/supabaseclient.js';

const router = Router();

router.post('/signup', async (req, res) => {
  const {
    email,
    password,
    fullName,
    phone,
    dateOfBirth, // expected as 'YYYY-MM-DD' — see note below
    address,
    nationality,
    gender,
  } = req.body ?? {};
  console.log('Request body:', req.body);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName ?? null,
        phone_number: phone ?? null,
        date_birth: dateOfBirth ?? null,
        address: address ?? null,
        nationality: nationality ?? null,
        gender: gender ?? null,
        role: 'CUSTOMER',
      },
    },
  });

  if (error) {
    console.log('Supabase signUp error:', JSON.stringify(error, null, 2));
    return res.status(error.status || 400).json({ error: error.message });
  }

  const { user, session } = data;

  return res.status(201).json({
    user: user ? { id: user.id, email: user.email } : null,
    session: session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
        }
      : null,
    requiresEmailConfirmation: !session,
  });
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase returns 400 for bad credentials — 401 is the more accurate
    // status for "these credentials didn't work" from an API consumer's
    // point of view, so we normalize it here.
    const status = error.status === 400 ? 401 : error.status || 401;
    return res.status(status).json({ error: error.message });
  }

  const { user, session } = data;

  return res.status(200).json({
    user: user ? { id: user.id, email: user.email } : null,
    session: session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
        }
      : null,
  });
});

// Mounted under /api in server.js, so this becomes /api/auth/refresh —
// matching the original route exactly, even though signup/signin don't
// share that /auth prefix.
router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: 'Refresh token is required' });
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    return res.status(400).json({ success: false, message: 'Invalid token' });
  }

  const { session } = data;

  return res.status(200).json({
    session: session
      ? {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at,
        }
      : null,
  });
});

export default router;
