import app from './App.js';

// Only used for local development — Vercel invokes app.js directly as a
// serverless function via api/index.js and never runs this file.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});