import dotenv from 'dotenv';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';

dotenv.config();

const app = createApp();
const port = process.env.PORT || 3000;
const mongoUri =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voltix';

async function start() {
  try {
    await connectDatabase(mongoUri);

    console.log(`Connected to MongoDB at ${mongoUri}`);

    app.listen(port, () => {
      console.log(`Idea House server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Could not start the server. Is MongoDB running?');
    console.error(error.message);
    process.exit(1);
  }
}

start();
