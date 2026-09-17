import { getSupabaseForUser } from '../config/supabaseclient.js';
import {jwtVerify, createRemoteJWKSet} from 'jose';

const JWKS = createRemoteJWKSet(new URL(process.env.SUPABASE_JWT_SECRET));

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('No token in header');
    return res.sendStatus(401);
  }
  try{
      const{payload} = await jwtVerify(token,JWKS,{
        issuer: `${process.env.SUPABASE_URL}/auth/v1`,
        audience: 'authenticated',
      });

  req.user = { id: payload.sub, email: payload.email, ...payload };;
  req.token = token;
  req.supabase = getSupabaseForUser(token);
  next();
  }catch(err){
    console.log('JWT verify failed:', err.message);
    return res.sendStatus(401);
  }
  
}
