import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import profileRoutes from './routes/profile.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.json({
    message: 'BuzzTap API is running',
    status: 'ok',
  });
});

// /api/signup, /api/signin, /api/auth/refresh
app.use('/api', authRoutes);

// /api/user/data, /api/user/balance, /api/user/updateuser, /api/user/profile/avatar
app.use('/api/user', userRoutes);

// /profile/:id
app.use('/', profileRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`BuzzTap API listening on port ${PORT}`);
});

export default app;