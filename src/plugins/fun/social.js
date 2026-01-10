
// import { UserConfig, Marriages, ScheduledMsg } from '../../database/schema.js';
import { successMessage, errorMessage, infoMessage } from '../../utils/textStyle.js';

async function getDB() {
    return await import('../../database/schema.js');
}

/**
 * .confess <message>
 * Envoie un message anonyme dans le groupe.
 */
export async function handleConfess(sock, m, args, from) {
    const isGroup = from.endsWith('@g.us');
    
    // MODE 1: Dans un groupe → .confess <message>
    if (isGroup) {
        if (!args[0]) return sock.sendMessage(from, { text: '📌 Usage: .confess <message>' }, { quoted: m });
        const confession = args.join(' ');
        
        // Tenter de supprimer le message original pour l'anonymat
        try {
            await sock.sendMessage(from, { delete: m.key });
        } catch (e) {
            // Pas admin, tant pis
        }
        
        await sock.sendMessage(from, {
            text: `💬 *Confession Anonyme*\n\n"${confession}"\n\n— Un membre du groupe`
        });
    } 
    // MODE 2: En DM → .confess <group_id> <message>
    else {
        if (args.length < 2) return sock.sendMessage(from, { 
            text: '📌 *Usage Confession DM :*\n\n.confess <ID_GROUPE> <message>\n\n💡 Utilisez .id dans le groupe pour obtenir son ID' 
        }, { quoted: m });
        
        const targetGroupId = args[0];
        const confession = args.slice(1).join(' ');
        
        // Vérifier que c'est bien un ID de groupe
        if (!targetGroupId.endsWith('@g.us')) {
            return sock.sendMessage(from, { text: '❌ ID invalide. Utilisez .id dans le groupe concerné.' }, { quoted: m });
        }
        
        try {
            await sock.sendMessage(targetGroupId, {
                text: `💬 *Confession Anonyme*\n\n"${confession}"\n\n— Quelqu'un`
            });
            
            await sock.sendMessage(from, { text: '✅ Confession envoyée anonymement !' }, { quoted: m });
        } catch (e) {
            await sock.sendMessage(from, { text: '❌ Erreur: Le bot n\'est pas dans ce groupe ou l\'ID est incorrect.' }, { quoted: m });
        }
    }
}

/**
 * .marry @user
 * Se marier virtuellement avec quelqu'un.
 */
export async function handleMarry(sock, m, args, from, senderJid) {
    const { Marriages } = await getDB();
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return sock.sendMessage(from, { text: '📌 Usage: .marry @user' }, { quoted: m });

    if (mentioned === senderJid) return sock.sendMessage(from, { text: '❌ Tu ne peux pas te marier avec toi-même (Narcissique va !)' }, { quoted: m });

    // Vérifier si l'un des deux est déjà marié
    const alreadyMarried = await Marriages.findOne({
        where: {
            [Symbol.for('or')]: [ // Sequelize OR operator workaround syntax or simply use Op.or if imported
                { husband: senderJid }, { wife: senderJid },
                { husband: mentioned }, { wife: mentioned }
            ]
        }
    });

    // Simplification Sequelize sans operator importé : on fait 2 queries ou brut
    // Utilisons une logique raw JS plus simple si Op n'est pas dispo
    const m1 = await Marriages.findOne({ where: { husband: senderJid } }) || await Marriages.findOne({ where: { wife: senderJid } });
    const m2 = await Marriages.findOne({ where: { husband: mentioned } }) || await Marriages.findOne({ where: { wife: mentioned } });

    if (m1) return sock.sendMessage(from, { text: '❌ Tu es déjà marié(e) ! Fidélité d\'abord.' }, { quoted: m });
    if (m2) return sock.sendMessage(from, { text: '❌ Cette personne est déjà prise ! Briseur de ménage...' }, { quoted: m });

    await Marriages.create({
        husband: senderJid,
        wife: mentioned
    });

    const msg = `💍 *VIVE LES MARIÉS !* 💍\n\n@${senderJid.split('@')[0]} 💘 @${mentioned.split('@')[0]}\n\n📅 Date: ${new Date().toLocaleDateString()}\n❤️ Félicitations !`;
    await sock.sendMessage(from, { text: msg, mentions: [senderJid, mentioned] }, { quoted: m });
}

/**
 * .divorce
 * Divorcer.
 */
export async function handleDivorce(sock, m, args, from, senderJid) {
    const { Marriages } = await getDB();
    const marriage = await Marriages.findOne({ where: { husband: senderJid } }) || await Marriages.findOne({ where: { wife: senderJid } });

    if (!marriage) {
        return sock.sendMessage(from, { text: '❌ Tu n\'es même pas marié(e) !' }, { quoted: m });
    }

    const partner = marriage.husband === senderJid ? marriage.wife : marriage.husband;
    await marriage.destroy();

    const msg = `💔 *DIVORCE PRONONCÉ* 💔\n\n@${senderJid.split('@')[0]} a quitté @${partner.split('@')[0]}...\nC'est triste, mais la vie continue. 🍺`;
    await sock.sendMessage(from, { text: msg, mentions: [senderJid, partner] }, { quoted: m });
}

/**
 * .tag-reminder @user <temps> <raison>
 */
export async function handleTagReminder(sock, m, args, from, senderJid) {
    const { ScheduledMsg } = await getDB();
    if (args.length < 3) return sock.sendMessage(from, { text: '📌 Usage: .tag-reminder @user 10m Rends l\'argent' }, { quoted: m });

    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return sock.sendMessage(from, { text: '❌ Mentionne quelqu\'un.' }, { quoted: m });

    const timeStr = args[1]; // ex: 10m
    const reason = args.slice(2).join(' ');

    const timeValue = parseInt(timeStr);
    const timeUnit = timeStr.trim().slice(-1).toLowerCase();

    let delayMs = 0;
    if (timeUnit === 'm') delayMs = timeValue * 60 * 1000;
    else if (timeUnit === 'h') delayMs = timeValue * 60 * 60 * 1000;
    else if (timeUnit === 's') delayMs = timeValue * 1000;
    else return sock.sendMessage(from, { text: '❌ Temps invalide (10s, 5m, 1h)' });

    const scheduledTime = new Date(Date.now() + delayMs);

    // Créer la tâche planifiée
    await ScheduledMsg.create({
        userJid: senderJid,
        targetJid: from, // Dans le groupe actuel
        content: `@${mentioned.split('@')[0]} 🔔 RAPPEL : ${reason}`, // Le message qui sera envoyé
        scheduledTime: scheduledTime,
        sent: false
    });

    await sock.sendMessage(from, { text: `✅ Rappel programmé pour @${mentioned.split('@')[0]} dans ${timeStr}.`, mentions: [mentioned] }, { quoted: m });
}
