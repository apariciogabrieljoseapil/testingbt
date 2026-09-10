import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cookieParser from 'cookie-parser';
import sharp from 'sharp';
import multer from 'multer';
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
    .from('costumer_account_information')
    .select('*')
    .single();

  if (error) return res.status(400).json({ success: false, message: error.message });
  
    let avatarUrl = null;
    const bucketName = 'costumer_account_profile';
    let objectPath = data.avatar_url;
    
    const path = new URL(objectPath).pathname;
    const result = path.split("/costumer_account_profile/")[1];
  if (data.avatar_url) {
    const { data: signedData, error: signError } = await req.supabase.storage
      .from(bucketName)
      .createSignedUrl(result, 3600); // valid for 1 hour

    if (signError) {
      console.error('Signed URL error:', signError);
    } else {
      avatarUrl = signedData.signedUrl;
      data.avatar_url = avatarUrl;
    }
  }
  
  console.log(avatarUrl);
  console.log(result);
  res.json({ success: true, data});
});

app.get('/api/user/balance',authenticateToken,async (req,res) =>{
  const {data,error} = await req.supabase
  .from('costumer_account_balance')
  .select('*')
  .single();

  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, data });
});


  const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


app.post('/api/user/updateuser', authenticateToken, async (req, res) => {

  try {
    const {
      fullname,
      phonenumber,
      datebirth,
      gender,
      address,
      nationality
    } = req.body;

    const userId = req.user.id;

    const { data, error } = await req.supabase
      .from('costumer_account_information')
      .update({
        full_name: fullname,
        phone_number: phonenumber,
        date_birth: datebirth,
        gender: gender,
        address: address,
        nationality: nationality
      })
      .eq('costumer_id', userId)

    if (error) {
      console.error('Update user error:', error);

      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId,{
      user_metadata: { full_name: fullname },
    });

    if (authError) {
      console.error('Auth metadata update error:', authError);
      // decide: fail the whole request, or just log and continue?
    }
    return res.status(200).json({
      success: true,
      message: 'User information updated successfully',
      data
    });

  } catch (err) {
    console.error('Server error:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB
app.post('/api/user/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `Invalid file type: ${req.file.mimetype}` })
    }

     let pngBuffer;
    try {
      pngBuffer = await sharp(req.file.buffer)
        .resize(512, 512, { fit: 'cover' }) // optional: normalize avatar dimensions too
        .png()
        .toBuffer();
    } catch (conversionErr) {
      console.error('Image conversion error:', conversionErr);
      return res.status(400).json({ error: 'Could not process image — file may be corrupted or unsupported.' });
    }

     const userFolder = `${req.user.id}`;
    
    // 1. List existing files in the user's folder
    const { data: existingFiles, error: listError } = await req.supabase.storage
      .from('costumer_account_profile')
      .list(userFolder);
      if (listError) {
      console.error('List error:', listError);
      return res.status(500).json({ error: listError.message });
    }

    // 2. Delete all existing files in that folder (if any)
    if (existingFiles && existingFiles.length > 0) {
      const pathsToDelete = existingFiles.map(file => `${userFolder}/${file.name}`);
      const { error: deleteError } = await req.supabase.storage
        .from('costumer_account_profile')
        .remove(pathsToDelete);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        return res.status(500).json({ error: deleteError.message });
      }
    }
    // 3. Build a new datetime-based filename
    const timestamp = Date.now(); // or new Date().toISOString().replace(/[:.]/g, '-')
    const filePath = `${userFolder}/avatar-${timestamp}.png`;

    const { error: uploadError } = await req.supabase.storage
      .from('costumer_account_profile')
      .upload(filePath, pngBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) return res.status(500).json({ error: uploadError.message });

    const { data: urlData } = req.supabase.storage
      .from('costumer_account_profile')
      .getPublicUrl(filePath);

    await req.supabase
      .from('costumer_account_information')
      .upsert(
      { costumer_id: req.user.id, avatar_url: urlData.publicUrl },
      { onConflict: 'costumer_id' }
      );
      if (upsertError) {
  console.error('Avatar DB upsert error:', upsertError);
  return res.status(500).json({ error: 'Failed to save avatar URL' });
}
    res.json({ success: true, path: filePath, publicUrl: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default app;