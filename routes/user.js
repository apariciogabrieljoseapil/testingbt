import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { authenticateToken } from '../middleware/Authenticate.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

router.get('/data', authenticateToken, async (req, res) => {
  const starttime = Date.now();
  const { data, error } = await req.supabase
    .from('costumer_account_information')
    .select('*')
    .single();

  if (error) return res.status(400).json({ success: false, message: error.message });

  const bucketName = 'costumer_account_profile';

  if (data.avatar_url) {
    const path = new URL(data.avatar_url).pathname;
    const result = path.split(`/${bucketName}/`)[1];

    const { data: signedData, error: signError } = await req.supabase.storage
      .from(bucketName)
      .createSignedUrl(result, 3600); // valid for 1 hour

    if (signError) {
      console.error('Signed URL error:', signError);
      data.avatar_url = null;
    } else {
      data.avatar_url = signedData.signedUrl;
    }
  }

  res.json({ success: true, data });
  console.log(`Finished time user data: ${Date.now()-starttime}`);
});

router.get('/balance', authenticateToken, async (req, res) => {
  const starttime = Date.now();
  const { data, error } = await req.supabase
    .from('costumer_account_balance')
    .select('*')
    .single();

  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, data });
  console.log(`Finished time user balance: ${Date.now()-starttime}`);
});

router.get('/transaction', authenticateToken, async (req, res) => {
  const starttime = Date.now();
  const { data, error } = await req.supabase
    .from('costumer_transaction_history')
    .select('*')
    .single();

  if (error) return res.status(400).json({ success: false, message: error.message });
  res.json({ success: true, data });
  console.log(`Finished time user transaction: ${Date.now()-starttime}`);
});

router.post('/updateuser', authenticateToken, async (req, res) => {
  const starttime = Date.now();
  try {
    const { fullname, phonenumber, datebirth, gender, address, nationality } = req.body;

    const { data, error } = await req.supabase.rpc('update_costumer_info', {
      pfullname: fullname ?? null,
      pphonenumber: phonenumber ?? null,
      pdatebirth: datebirth ?? null,
      pgender: gender ?? null,
      paddress: address ?? null,
      pnation: nationality ?? null,
    });

    if (error) {
      console.error('Update user error:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
    console.log(`Finished time update data: ${Date.now() - starttime}`);
    return res.status(200).json({
      success: true,
      message: 'User information updated successfully',
      data,
    });
    
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/profile/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: `Invalid file type: ${req.file.mimetype}` });
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
      const pathsToDelete = existingFiles.map((file) => `${userFolder}/${file.name}`);
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

    const { error: updateError } = await req.supabase
      .from('costumer_account_information')
      .update({ avatar_url: urlData.publicUrl })
      .eq('costumer_id', req.user.id);

    if (updateError) {
      console.error('Avatar DB update error:', updateError);
      return res.status(500).json({ error: 'Failed to save avatar URL' });
    }

    res.json({ success: true, path: filePath, publicUrl: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
