import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
const app = express();

// Public client — used for the actual auth call (signUp, signIn, etc).
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
// console.log("SUPABASE_URL is:", JSON.stringify(process.env.SUPABASE_URL));
// console.log("SUPABASE_ANON_KEY is:", JSON.stringify(process.env.SUPABASE_ANON_KEY));
app.use(express.json());
app.use(cookieParser());
app.get('/', (req, res) => {
  res.json({
    message: 'BuzzTap API is running',
    status: 'ok'
  });
});

app.post('/api/signup', async (req, res) => {
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
  console.log("Request body:", req.body);
   
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  // Profile fields ride along in options.data as raw_user_meta_data.
  // The on_auth_user_created_provision_customer trigger (see
  // costumer_schema.sql) reads them from there and, in the SAME
  // transaction as this signup, creates the costumer_account_info row
  // and the costumer_balance row (starting at 0). If that trigger
  // throws for any reason, this call returns an error below — no
  // manual insert step needed here, and no risk of a user existing
  // without a profile/balance.
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
      },
    },
  });

  if (error) {
    console.log("Supabase signUp error:", JSON.stringify(error, null, 2));
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

app.post('/api/signin', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password,});

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

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) { 
    return res.status(400).json({ success: false, message: 'Refresh token is required' }); }
  const{data,error} = await supabase.auth.refreshSession({
    refresh_token: refreshToken
  });
  if(error || !data.session){
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

function getSupabaseForUser(accessToken) {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}
async function authenticateToken(req, res, next) {
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
app.get('/api/user/data', authenticateToken, async (req, res) => {
  const { data, error } = await req.supabase
    .from('customer_account_information')
    .select('*')
    .single();

  if (error) return res.status(400).json({ success: false, message: error.message });

  res.json({ success: true, data });
});
export default app;