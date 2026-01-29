// Load environment variables BEFORE any other imports
import 'dotenv/config';

import { createApp } from './app.js';

const app = createApp();
const PORT = process.env.PORT || 3001;

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
