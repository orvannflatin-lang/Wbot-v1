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
  },
  shortcuts: {
    type: DataTypes.TEXT, // Stockera un JSON { "👽": "vv", "💾": "save" }
    defaultValue: '{}',
    allowNull: true
  },
  autoLikeStatus: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  likeEmoji: {
    type: DataTypes.STRING,
    defaultValue: '💚'
  },
  persona: {
    type: DataTypes.STRING,
    defaultValue: 'normal'
  },
  banned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  bannedAt: {
    type: DataTypes.DATE,
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

// Table Scheduled Messages (Pour .schedule, .remind)
export const ScheduledMsg = sequelize.define('ScheduledMsg', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  targetJid: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  scheduledTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});
export const ScheduledTask = sequelize.define('ScheduledTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  triggerTime: { type: DataTypes.DATE, allowNull: false },
  actionType: { type: DataTypes.STRING, allowNull: false },
  targetJid: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: true },
  mediaPath: { type: DataTypes.STRING, allowNull: true },
  executed: { type: DataTypes.BOOLEAN, defaultValue: false }
});

// Table Paramètres Groupe (.antilien, .lock)
export const GroupSettings = sequelize.define('GroupSettings', {
  jid: { type: DataTypes.STRING, primaryKey: true },
  antilink: { type: DataTypes.BOOLEAN, defaultValue: false },
  antibot: { type: DataTypes.BOOLEAN, defaultValue: false },
  welcome: { type: DataTypes.BOOLEAN, defaultValue: false },
  locked: { type: DataTypes.BOOLEAN, defaultValue: false },
  muteDuration: { type: DataTypes.INTEGER, defaultValue: 0 }
});

// Table Stats Utilisateur (.topactive)
export const UserStat = sequelize.define('UserStat', {
  uid: { type: DataTypes.STRING, primaryKey: true },
  msgCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastSeen: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  exp: { type: DataTypes.INTEGER, defaultValue: 0 },
  level: { type: DataTypes.INTEGER, defaultValue: 1 }
});

// Table Avertissements (.warn)
export const Warns = sequelize.define('Warns', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userJid: { type: DataTypes.STRING, allowNull: false },
  groupJid: { type: DataTypes.STRING, allowNull: false },
  reason: { type: DataTypes.STRING, defaultValue: 'Non spécifié' },
  count: { type: DataTypes.INTEGER, defaultValue: 1 }
});

// Table AFK (.away)
export const AfkConfig = sequelize.define('AfkConfig', {
  jid: { type: DataTypes.STRING, primaryKey: true },
  reason: { type: DataTypes.STRING, defaultValue: 'Occupé' },
  timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// Table Mariages (.marry)
export const Marriages = sequelize.define('Marriages', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  husband: { type: DataTypes.STRING, allowNull: false },
  wife: { type: DataTypes.STRING, allowNull: false },
  marriageDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
});

// Initialiser la base de données
export async function initDatabase() {
  try {
    await sequelize.authenticate();
    // console.log('📦 Connexion Base de Données établie.');
    await sequelize.sync({ alter: true, logging: false });
    // console.log('📦 Base de Données synchronisée (ALL TABLES).');

    // Supprimer la table de backup problématique avant sync (gestion silencieuse)
    try {
      await sequelize.query('DROP TABLE IF EXISTS `UserConfigs_backup`;').catch(() => { });
      await sequelize.query('DROP TABLE IF EXISTS `UserConfigs_backup_v2`;').catch(() => { });
    } catch (e) {
      // Ignorer silencieusement toutes les erreurs de suppression
    }

    // 4. Migration Manuelle SAFE (SQLite)
    // Au lieu de sync({ alter: true }) qui crash, on ajoute les colonnes manuellement si manquantes
    try {
      await sequelize.query("ALTER TABLE UserConfigs ADD COLUMN tagAllEmoji TEXT DEFAULT '📢'").catch(() => { });
      // await sequelize.query("ALTER TABLE UserConfigs ADD COLUMN autreColonne TEXT").catch(() => {});
    } catch (e) {
      // Ignorer si existe déjà
    }

    // Désactiver le backup automatique de Sequelize qui cause des erreurs
    await sequelize.sync({ alter: false, logging: false });
    // console.log('✅ Tables de base de données synchronisées (Safe Mode)');

    // 4. Backup & Migration Logique (SQLite Safe) - DÉSACTIVÉ pour éviter les erreurs
    // Le backup cause des problèmes de colonnes, on le désactive complètement
    // Si vous avez besoin d'un backup, faites-le manuellement avant de modifier la structure
    /*
    try {
      const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='UserConfigs';");
      if (tables.length > 0) {
        const [columns] = await sequelize.query("PRAGMA table_info(UserConfigs);");
        const columnNames = columns.map(col => col.name).join(', ');
        await sequelize.query('DROP TABLE IF EXISTS `UserConfigs_backup_v2`;');
        await sequelize.query(`CREATE TABLE IF NOT EXISTS \`UserConfigs_backup_v2\` AS SELECT ${columnNames} FROM \`UserConfigs\` WHERE 0 = 1;`);
        await sequelize.query(`INSERT INTO \`UserConfigs_backup_v2\` (${columnNames}) SELECT ${columnNames} FROM \`UserConfigs\`;`);
        console.log('✅ Sauvegarde UserConfigs effectuée (Table v2).');
      }
    } catch (e) {
      console.warn('⚠️ Backup UserConfigs ignoré (non bloquant):', e.message);
    }
    */

    return true;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.message.includes('SQLITE_CONSTRAINT')) {
      console.log('⚠️ Note: Tables déjà synchronisées (Erreur contrainte ignorée)');
      return true;
    }
    console.error('❌ Erreur base de données:', error);
    return false;
  }
}

export { sequelize };
