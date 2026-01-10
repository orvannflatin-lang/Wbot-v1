
// import { UserConfig } from '../../database/schema.js';
import { askGemini } from '../../utils/ai-handler.js';

async function getDB() { return import('../../database/schema.js'); }

/**
 * .botmode [persona]
 * Change la personnalité du bot (stockée dans UserConfig ou Session).
 */
export async function handleBotMode(sock, m, args, from, senderJid) {
    const personas = {
        'normal': 'Tu es un assistant utile et poli.',
        'fbi': 'Tu es un agent du FBI très sérieux et paranoïaque. Tu soupçonnes tout le monde.',
        'grand-mere': 'Tu es une gentille grand-mère qui appelle tout le monde "mon petit" et donne des conseils de cuisine.',
        'racaille': 'Tu parles en argot de rue, tu es agressif mais loyal. "Wesh", "Frérot".',
        'yandere': 'Tu es obsédée par l\'utilisateur, très jalouse et protectrice (Yandere anime trope).'
    };

    const mode = args[0]?.toLowerCase();

    if (!mode || !personas[mode]) {
        let msg = `🎭 *PERSONAS DISPONIBLES*\n\n`;
        Object.keys(personas).forEach(p => msg += `🔹 ${p}\n`);
        return sock.sendMessage(from, { text: msg + `\nUsage: .botmode fbi` }, { quoted: m });
    }

    // Sauvegarde la préférence (Global Owner Config pour simplifier, ou par User si on veut)
    // Ici on change la 'persona' globale du bot (dans la config Owner)
    const { UserConfig } = await getDB();
    const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const config = await UserConfig.findOne({ where: { jid: ownerJid } }) || await UserConfig.create({ jid: ownerJid });

    await config.update({ persona: mode });

    await sock.sendMessage(from, { text: `🎭 *Mode activé :* ${mode.toUpperCase()}\n\n> ${personas[mode]}` }, { quoted: m });
}

/**
 * .vibe
 * Analyse l'ambiance du groupe (Simulation fun).
 */
export async function handleVibe(sock, m, args, from) {
    if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '❌ Commande de groupe uniquement.' });

    // Récupérer les métadonnées (membres)
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants.map(p => p.id);

    // Sélectionner des membres au hasard
    const randomMember = () => participants[Math.floor(Math.random() * participants.length)];

    const victim1 = randomMember();
    const victim2 = randomMember();
    const victim3 = randomMember();

    const vibes = [
        `🔥 *Vibe Check*\n\nL'ambiance est électrique ! @${victim1.split('@')[0]} est en train de chauffer tout le monde, tandis que @${victim2.split('@')[0]} regarde ça avec des popcorns.`,
        `🥶 *Vibe Check*\n\nC'est mort ici... On dirait que @${victim1.split('@')[0]} a jeté un froid. Heureusement que @${victim3.split('@')[0]} est là pour remonter le niveau.`,
        `🤡 *Vibe Check*\n\nLe cirque est en ville ! @${victim1.split('@')[0]} fait le clown, et @${victim2.split('@')[0]} rigole à toutes ses blagues nulles.`,
        `💕 *Vibe Check*\n\nIl y a de l'amour dans l'air... Je soupçonne @${victim1.split('@')[0]} de kiffer @${victim3.split('@')[0]} en secret. 👀`,
        `🚓 *Vibe Check*\n\n@${victim1.split('@')[0]} est recherché par la police du fun pour "excès de lourdeur". @${victim2.split('@')[0]} est le témoin clé.`
    ];

    const randomVibe = vibes[Math.floor(Math.random() * vibes.length)];

    await sock.sendMessage(from, {
        text: randomVibe,
        mentions: [victim1, victim2, victim3]
    }, { quoted: m });
}
