import { Sequelize, DataTypes } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialiser SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../wbot.db'),
  logging: false
});

// Table User Config
export const UserConfig = sequelize.define('UserConfig', {
  jid: {
    type: DataTypes.STRING,
    primaryKey: true,
    allowNull: false
  },
  prefix: {
    type: DataTypes.STRING,
    defaultValue: '.'
  },
  ghostMode: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isOwner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  antidelete: {
    type: DataTypes.TEXT,
    defaultValue: '{}',
    allowNull: true
  }
});

// Table Scheduled Status
export const ScheduledStatus = sequelize.define('ScheduledStatus', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  mediaPath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  scheduledTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  posted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Table Saved ViewOnce
export const SavedViewOnce = sequelize.define('SavedViewOnce', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  messageId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fromJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  savedByJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaPath: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Table Saved Status
export const SavedStatus = sequelize.define('SavedStatus', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  statusId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fromJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  savedByJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  mediaPath: {
    type: DataTypes.STRING,
    allowNull: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mediaType: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

// Initialiser la base de données
export async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');
    
    await sequelize.sync();
    console.log('✅ Tables de base de données créées');
    
    return true;
  } catch (error) {
    console.error('❌ Erreur base de données:', error);
    return false;
  }
}

export { sequelize };
