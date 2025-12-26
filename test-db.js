import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing DB Connection...');

try {
  const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'wbot_test.db'),
    logging: console.log
  });

  await sequelize.authenticate();
  console.log('✅ SQLite Connection Successful');
} catch (error) {
  console.error('❌ SQLite Connection Failed:', error);
}
