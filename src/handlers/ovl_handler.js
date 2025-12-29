
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import { UserConfig } from '../database/schema.js';
import { generateHelpMenu, generateCommandHelp } from '../utils/helpMenu.js';
import { successMessage, errorMessage, infoMessage, EMOJIS, toBold } from '../utils/textStyle.js';

// Configuration OVL
const CONFIG = {
    ownerName: process.env.NOM_OWNER || 'Admin',
    prefix: '.',
    emoji: '💚' // Emoji par défaut pour l'auto-like
};

/**
 * Cerveau Principal - OVL Handler
 */
export async function OVLHandler(sock, msg) {
    const m = msg.messages[0];
    if (!m.message) return;

    // Ignorer les messages "broadcast" sauf status
    const isStatus = m.key.remoteJid === 'status@broadcast';

    // 1. AUTO-LIKE STATUS (Priorité Haute)
    if (isStatus) {
        return handleAutoLike(sock, m);
    }

    const from = m.key.remoteJid;
    const isMe = m.key.fromMe;
    const type = Object.keys(m.message)[0];
    const content = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || '';
    const body = content.trim();

    // 🔄 GESTION PRÉFIXE ET SHORTCUTS DYNAMIQUES
    let userPrefix = CONFIG.prefix;
    let customShortcuts = {};

    try {
        const userConfig = await UserConfig.findOne({ where: { jid: from } });
        if (userConfig) {
            if (userConfig.prefix) userPrefix = userConfig.prefix;
            if (userConfig.shortcuts) customShortcuts = JSON.parse(userConfig.shortcuts);
        }
    } catch (e) { }

    // 🎭 EMOJI SHORTCUTS (Défaut + Custom)
    let EMOJI_MAP = {
        '👁️': 'vv',
        '👀': 'vv',
        '💾': 'save',
        '🏓': 'ping',
        '👻': 'ghost on',
        '🌞': 'ghost off',
        '📋': 'menu'
    };

    // Fusionner avec les shortcuts customs (les customs écrasent les défauts)
    EMOJI_MAP = { ...EMOJI_MAP, ...customShortcuts };

    let isCmd = body.startsWith(userPrefix);
    let command = '';
    let args = [];

    // Vérifier si c'est un Emoji Shortcut
    if (EMOJI_MAP[body]) {
        isCmd = true;
        const fullCmd = EMOJI_MAP[body].split(' ');
        command = fullCmd[0];
        args = fullCmd.slice(1);
    } else {
        // Logique standard préfixe
        command = isCmd ? body.slice(userPrefix.length).split(' ')[0].toLowerCase() : '';
        args = body.trim().split(/ +/).slice(1);
    }

    // Si c'est un shortcut d'un seul caractère (ex: "s" pour "save" sans préfixe défini comme shortcut)
    // Logique AMDA permet aux utilisateurs de définir n'importe quoi comme trigger

    const q = args.join(' ');

    // 🔧 DEBUG: Log tous les messages pour voir ce qui arrive
    console.log('📨 Message reçu:', {
        from: from,
        isMe: isMe,
        body: body,
        isCmd: isCmd,
        command: command,
        prefixUsed: userPrefix
    });

    // 3. ANTI-DELETE (Géré par un event listener séparé dans index.js)

    // 4. COMMANDES
    if (isCmd) {
        console.log(`Commande détectée: ${command} de ${from}`);

        switch (command) {
            case 'ping':
                const start = Date.now();
                const ping = await sock.sendMessage(from, { text: `${EMOJIS.loading} ${toBold('Testing...')}` }, { quoted: m });
                const latency = Date.now() - start;
                await sock.sendMessage(from, {
                    edit: ping.key,
                    text: successMessage('PONG! 🏓', `Latence: ${latency}ms`, [
                        `Vitesse: ${latency < 100 ? 'Rapide ⚡' : latency < 300 ? 'Normal 🟢' : 'Lent 🔴'}`,
                        `Bot: En ligne ✅`,
                        `Préfixe: ${userPrefix}`
                    ])
                });
                break;

            case 'setprefix':
                if (!args[0]) {
                    return sock.sendMessage(from, {
                        text: `📌 *Usage :* ${userPrefix}setprefix <nouveau_prefixe>\nExemple: ${userPrefix}setprefix !`
                    }, { quoted: m });
                }
                const newPrefix = args[0];
                await UserConfig.upsert({ jid: from, prefix: newPrefix });
                await sock.sendMessage(from, {
                    text: successMessage('PRÉFIXE MODIFIÉ', `Votre nouveau préfixe est : ${toBold(newPrefix)}`, [
                        'Essayez .ping avec le nouveau préfixe'
                    ])
                }, { quoted: m });
                break;

            case 'setshortcut':
                if (args.length < 2) {
                    return sock.sendMessage(from, {
                        text: `📌 *Usage :* ${userPrefix}setshortcut <trigger> <commande>\n\nExemple:\n${userPrefix}setshortcut 👽 vv\n${userPrefix}setshortcut s save`
                    }, { quoted: m });
                }

                const trigger = args[0]; // L'emoji ou le mot (ex: 👽)
                const targetCmd = args.slice(1).join(' '); // La commande cible (ex: vv)

                // Sauvegarder dans DB
                try {
                    const conf = await UserConfig.findOne({ where: { jid: from } }) || await UserConfig.create({ jid: from });
                    let shortcuts = JSON.parse(conf.shortcuts || '{}');
                    shortcuts[trigger] = targetCmd;

                    await UserConfig.update({ shortcuts: JSON.stringify(shortcuts) }, { where: { jid: from } });

                    await sock.sendMessage(from, {
                        text: successMessage('RACCOURCI AJOUTÉ', `Trigger: ${trigger} → ${targetCmd}`, [
                            `Envoyez juste "${trigger}" pour lancer ${targetCmd}`
                        ])
                    }, { quoted: m });
                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(from, { text: errorMessage('Erreur Base de Données') }, { quoted: m });
                }
                break;

            case 'delshortcut':
                if (!args[0]) return sock.sendMessage(from, { text: `Usage: ${userPrefix}delshortcut <trigger>` }, { quoted: m });
                try {
                    const conf = await UserConfig.findOne({ where: { jid: from } });
                    if (conf) {
                        let shortcuts = JSON.parse(conf.shortcuts || '{}');
                        delete shortcuts[args[0]];
                        await UserConfig.update({ shortcuts: JSON.stringify(shortcuts) }, { where: { jid: from } });
                        await sock.sendMessage(from, { text: successMessage('RACCOURCI SUPPRIMÉ', `Le raccourci "${args[0]}" a été retiré.`) }, { quoted: m });
                    }
                } catch (e) { }
                break;

            case 'menu':
            case 'help':
                // Passer le préfixe actuel à la génération du menu
                // On passe aussi les shortcuts pour l'affichage
                const currentConfig = {
                    ...CONFIG,
                    prefix: userPrefix,
                    customShortcuts: EMOJI_MAP
                };
                if (args[0]) {
                    const commandHelp = generateCommandHelp(args[0], currentConfig);
                    await sock.sendMessage(from, { text: commandHelp }, { quoted: m });
                } else {
                    const menu = generateHelpMenu(currentConfig);
                    await sock.sendMessage(from, { text: menu }, { quoted: m });
                }
                break;

            case 'save':
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    return sock.sendMessage(from, { text: errorMessage('ERREUR', 'Veuillez répondre à un statut ou une image !') }, { quoted: m });
                }
                const quotedMsgForSave = m.message.extendedTextMessage.contextInfo.quotedMessage;
                await handleSaveStatus(sock, m, quotedMsgForSave);
                break;

            case 'vv':
                // 👁️ RÉCUPÉRATION VUE UNIQUE (Manuel)
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    return sock.sendMessage(from, { text: errorMessage('ERREUR', 'Répondez à une vue unique avec .vv') }, { quoted: m });
                }

                const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                const viewOnceMsg = quotedMsg.viewOnceMessage || quotedMsg.viewOnceMessageV2;

                if (viewOnceMsg) {
                    const actualMsg = viewOnceMsg.message;
                    await handleManualViewOnce(sock, m, actualMsg);
                } else {
                    // Essayer de voir si c'est directement un media ViewOnce sans container (cas rares) ou juste un media normal
                    // Pour être sympa, on permet aussi de voler les images normales avec .vv
                    await handleManualViewOnce(sock, m, quotedMsg);
                }
                break;

            case 'autolike':
                if (!args[0]) {
                    return sock.sendMessage(from, {
                        text: `📌 *Usage Auto-Like :*\n\n${userPrefix}autolike on\n${userPrefix}autolike off\n${userPrefix}autolike emoji 💚`
                    }, { quoted: m });
                }

                if (args[0] === 'emoji' && args[1]) {
                    await UserConfig.upsert({ jid: from, likeEmoji: args[1] });
                    await sock.sendMessage(from, {
                        text: successMessage('AUTO-LIKE', `Emoji modifié : ${args[1]}`)
                    }, { quoted: m });

                } else if (args[0] === 'on' || /\p{Emoji}/u.test(args[0])) {
                    const emoji = /\p{Emoji}/u.test(args[0]) ? args[0] : '💚';
                    await UserConfig.upsert({ jid: from, autoLikeStatus: true, likeEmoji: emoji });
                    await sock.sendMessage(from, {
                        text: successMessage('AUTO-LIKE ACTIVÉ', `Emoji : ${emoji}`)
                    }, { quoted: m });

                } else if (args[0] === 'off') {
                    await UserConfig.update({ autoLikeStatus: false }, { where: { jid: from } });
                    await sock.sendMessage(from, {
                        text: infoMessage('AUTO-LIKE DÉSACTIVÉ', ['Les statuts ne seront plus likés'])
                    }, { quoted: m });
                }
                break;

            case 'ghost':
                if (!args[0]) {
                    return sock.sendMessage(from, {
                        text: `📌 *Usage Ghost :*\n${userPrefix}ghost on\n${userPrefix}ghost off`
                    }, { quoted: m });
                }

                if (args[0] === 'on') {
                    await UserConfig.upsert({ jid: from, ghostMode: true });
                    sock.sendPresenceUpdate('unavailable', from);
                    await sock.sendMessage(from, {
                        text: successMessage('GHOST MODE ACTIVÉ', '👻 Coches bleues masquées')
                    }, { quoted: m });

                } else if (args[0] === 'off') {
                    await UserConfig.update({ ghostMode: false }, { where: { jid: from } });
                    await sock.sendMessage(from, {
                        text: infoMessage('GHOST MODE DÉSACTIVÉ', ['Vous êtes visible'])
                    }, { quoted: m });
                }
                break;

            case 'antidelete':
                if (!args[0]) {
                    return sock.sendMessage(from, {
                        text: `📌 *Usage :* ${userPrefix}antidelete all/pm/gc/status/off`
                    }, { quoted: m });
                }

                const mode = args[0];
                const [config, created] = await UserConfig.findOrCreate({ where: { jid: from } });
                let settings = JSON.parse(config.antidelete || '{}');

                if (mode === 'off') {
                    settings = {};
                    await config.update({ antidelete: JSON.stringify(settings) });
                    await sock.sendMessage(from, { text: infoMessage('ANTI-DELETE OFF') }, { quoted: m });
                } else if (['all', 'pm', 'gc', 'status'].includes(mode)) {
                    settings = { [mode]: true };
                    await config.update({ antidelete: JSON.stringify(settings) });
                    await sock.sendMessage(from, { text: successMessage('ANTI-DELETE ACTIVÉ', `Mode: ${mode}`) }, { quoted: m });
                }
                break;

            case 'dl':
                if (!q) return sock.sendMessage(from, { text: `📌 *Usage :* ${userPrefix}dl <lien_tiktok_insta_fb>` }, { quoted: m });

                await sock.sendMessage(from, { react: { text: '⏳', key: m.key } });
                await sock.sendMessage(from, { text: '⬇️ *Recherche du média en cours...*' }, { quoted: m });

                try {
                    // Essai basique avec API publique pour TikTok (le plus demandé)
                    // Note: C'est une API publique, stabilité non garantie à 100%
                    if (q.includes('tiktok.com')) {
                        const apiUrl = `https://api.giftedtech.my.id/api/download/tiktok?url=${q}&apikey=gifted`;
                        const response = await fetch(apiUrl);
                        const data = await response.json();

                        if (data.success && (data.result.video_hd || data.result.video_sd)) {
                            const videoUrl = data.result.video_hd || data.result.video_sd;
                            await sock.sendMessage(from, {
                                video: { url: videoUrl },
                                caption: `✅ *Vidéo TikTok Téléchargée*\n\n> © WBOT`
                            }, { quoted: m });
                            await sock.sendMessage(from, { react: { text: '✅', key: m.key } });
                        } else {
                            throw new Error('API Error');
                        }
                    } else {
                        throw new Error('Non supporté');
                    }
                } catch (e) {
                    await sock.sendMessage(from, {
                        text: errorMessage('ÉCHEC TÉLÉCHARGEMENT', 'Désolé, impossible de télécharger ce lien pour le moment.\n\nLe module DL complet arrive très bientôt !')
                    }, { quoted: m });
                }
                break;
        }
    }
}

/**
 * FEATURE: Sauvegarde de Statut/Média vers "Notes à soi-même"
 */
async function handleSaveStatus(sock, m, quotedMsg) {
    try {
        await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

        // Téléchargement sécurisé
        const buffer = await downloadMediaMessage(
            { key: m.key, message: quotedMsg },
            'buffer',
            {},
            { logger: console }
        );

        if (!buffer) throw new Error('Échec téléchargement');

        // Envoi dans "Notes à soi-même" (Le JID du bot lui-même)
        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'; // Nettoyage JID

        // Détecter type
        const isVideo = quotedMsg.videoMessage;
        const isImage = quotedMsg.imageMessage;
        const caption = '💾 *Statut Sauvegardé*';

        if (isVideo) {
            await sock.sendMessage(myJid, { video: buffer, caption: caption });
        } else if (isImage) {
            await sock.sendMessage(myJid, { image: buffer, caption: caption });
        }

        await sock.sendMessage(m.key.remoteJid, { react: { text: '✅', key: m.key } });
        await sock.sendMessage(m.key.remoteJid, { text: '✅ Statut envoyé dans vos messages personnels !' }, { quoted: m });

    } catch (e) {
        console.error('Erreur Save:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erreur lors de la sauvegarde.' }, { quoted: m });
    }
}

/**
 * FEATURE: Auto-Like
 */
async function handleAutoLike(sock, m) {
    try {
        // Vérifier config DB
        const config = await UserConfig.findOne();
        if (!config || !config.autoLikeStatus) return;

        // Réagir avec l'emoji configuré
        await sock.sendMessage(m.key.remoteJid, {
            react: {
                text: config.likeEmoji || '💚',
                key: m.key
            }
        });
        console.log('💚 Status Liked:', m.key.participant);
    } catch (e) {
        console.error('AutoLike Error:', e);
    }
}

/**
 * FEATURE: Manual ViewOnce Recovery (.vv)
 */
async function handleManualViewOnce(sock, m, viewOnceMessageContent) {
    try {
        // Identifier le type de média
        const type = Object.keys(viewOnceMessageContent)[0]; // imageMessage, videoMessage, audioMessage...

        if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(type) && !viewOnceMessageContent.url) {
            return sock.sendMessage(m.key.remoteJid, { text: '❌ Ce message ne semble pas contenir de média valide.' }, { quoted: m });
        }

        await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

        // Télécharger
        const buffer = await downloadMediaMessage(
            { key: m.key, message: viewOnceMessageContent }, // On passe le contenu direct s'il n'est pas enveloppé
            'buffer',
            {},
            { logger: console }
        );

        const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const caption = '👁️ *Vue Unique Récupérée*';

        if (type === 'videoMessage') {
            await sock.sendMessage(myJid, { video: buffer, caption: caption });
        } else if (type === 'imageMessage') {
            await sock.sendMessage(myJid, { image: buffer, caption: caption });
        } else if (type === 'audioMessage') {
            await sock.sendMessage(myJid, { audio: buffer, mimetype: 'audio/mp4', ptt: true }); // Envoyer comme vocal
        }

        await sock.sendMessage(m.key.remoteJid, { react: { text: '✅', key: m.key } });
        console.log('👁️ Vue unique récupérée via .vv !');

    } catch (e) {
        console.error('VV Error:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erreur récupération : ' + e.message }, { quoted: m });
    }
}
