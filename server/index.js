const express = require('express');
const cors = require('cors');
const path = require('path');

const geminiRoutes = require('./gemini-api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Routes
app.use('/api', geminiRoutes);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Vercel requires module.exports for serverless functions
module.exports = app;

// Only listen if not in Vercel environment
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}