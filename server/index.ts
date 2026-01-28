import dotenv from 'dotenv';
import { createApp } from './app.js';

// Load environment variables
dotenv.config();

const app = createApp();
const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

