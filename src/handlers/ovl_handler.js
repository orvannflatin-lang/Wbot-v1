
import { downloadMediaMessage, delay } from '@whiskeysockets/baileys';
import fs from 'fs';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import { UserConfig } from '../database/schema.js';
import { generateHelpMenu, generateCommandHelp } from '../utils/helpMenu.js';
import { successMessage, errorMessage, infoMessage, EMOJIS, toBold } from '../utils/textStyle.js';
import { downloadWithYtdlp, downloadAudioMp3, cleanupFile } from '../utils/ytdlp-handler.js';
import { askGemini, analyzeImageWithGemini } from '../utils/ai-handler.js';

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

    // DEBUG GLOBAL POUR STATUTS
    // if (m.key.remoteJid === 'status@broadcast') {
    //    console.log(`📡 OVL DETECT: Status de ${m.key.participant}`);
    // }

    // Ignorer les messages "broadcast" sauf status
    const isStatus = m.key.remoteJid === 'status@broadcast';

    // 1. AUTO-LIKE STATUS (Priorité Haute)
    // ⚠️ CRITIQUE: Filtrer les statuts sans participant (vides/corrompus)
    if (isStatus) {
        console.log(`💚 STATUS DETECTÉ: ${m.key.participant}`);
        if (!m.key.participant) {
            console.log('⚠️ Statut ignoré: participant manquant');
            return;
        }
        return handleAutoLike(sock, m);
    }

    const from = m.key.remoteJid;
    const isMe = m.key.fromMe;
    // 🔧 FIX: Conserver le JID original pour les réponses contextuelles
    // 🔧 FIX: Conserver le JID original pour les réponses contextuelles
    const originalFrom = m.key.remoteJid;

    // 🕵️ DEBUG : Inspecter la structure du message pour comprendre pourquoi 'body' est vide
    // console.log('📨 RAW MESSAGE:', JSON.stringify(m.message));

    // 🔓 UNWRAP (Déballer les messages éphémères/ViewOnce)
    let msgContent = m.message;
    if (msgContent?.ephemeralMessage) msgContent = msgContent.ephemeralMessage.message;
    if (msgContent?.viewOnceMessage) msgContent = msgContent.viewOnceMessage.message;
    if (msgContent?.viewOnceMessageV2) msgContent = msgContent.viewOnceMessageV2.message;

    const type = Object.keys(msgContent || {})[0];
    const content = msgContent?.conversation
        || msgContent?.extendedTextMessage?.text
        || msgContent?.imageMessage?.caption
        || msgContent?.videoMessage?.caption
        || '';
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

    // Logs Activés (Demande utilisateur)
    if (body) {
        console.log(`📨 MSG REÇU [${from.split('@')[0]}]: ${body.length > 50 ? body.substring(0, 50) + '...' : body}`);
    } else if (m.message) {
        console.log(`📨 MSG REÇU [${from.split('@')[0]}]: [Média/Autre]`);
    }

    // console.log('📨 Message reçu:', { from, isMe, body, isCmd, command, prefixUsed: userPrefix });

    // 3. ANTI-DELETE (Géré par un event listener séparé dans index.js)

    // 4. RÉPONSE AUTO AUX QUESTIONS (Si ce n'est pas une commande et que c'est le propriétaire)
    if (!isCmd && body.length > 5 && isMe) {
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderJid = m.key.participant || from;
        const isOwner = senderJid === ownerJid || from.startsWith(sock.user.id.split(':')[0]);

        // Ne répondre qu'aux messages du propriétaire
        if (isOwner && !body.startsWith(userPrefix) && body.trim().length > 3) {
            // Détecter si c'est une question (se termine par ? ou contient des mots interrogatifs)
            const isQuestion = body.includes('?') ||
                /^(qui|quoi|où|comment|pourquoi|quand|quel|quelle|combien|est-ce|peux-tu|peut-on|as-tu)/i.test(body.trim());

            // Ne répondre qu'aux vraies questions pour éviter de spammer
            if (isQuestion) {
                try {
                    await sock.sendMessage(originalFrom, { react: { text: '🤖', key: m.key } });

                    console.log(`🤖 Question auto-détectée: ${body}`);
                    const aiRes = await askGemini(body);

                    if (aiRes && !aiRes.startsWith('⚠️')) {
                        await sock.sendMessage(originalFrom, {
                            text: `🤖 *Réponse :*\n\n${aiRes}`
                        }, { quoted: m });
                    }
                } catch (e) {
                    console.error('❌ Erreur réponse auto:', e);
                    // Ne rien faire en cas d'erreur pour ne pas spammer
                }
                return; // Sortir pour ne pas traiter comme commande
            }
        }
    }

    // 5. COMMANDES
    if (isCmd) {
        // 🔒 SÉCURITÉ : Vérifier que c'est le propriétaire
        const ownerJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const senderJid = isMe ? ownerJid : (m.key.participant || from);
        const isOwner = senderJid === ownerJid || from.startsWith(sock.user.id.split(':')[0]);

        if (!isOwner) {
            // Vérifier si l'utilisateur est banni
            const userCheck = await UserConfig.findOne({ where: { jid: senderJid } });
            if (userCheck?.banned) {
                console.log(`🚫 Utilisateur banni: ${senderJid}`);
                return;
            }
            console.log('\x1b[31m%s\x1b[0m', `🚫 Commande bloquée: ${command} de ${senderJid} (non-propriétaire)`);
            return; // Ignorer silencieusement
        }

        console.log('\x1b[32m%s\x1b[0m', `✅ COMMANDE DÉTECTÉE: .${command} (Propriétaire)`);

        switch (command) {
            case 'ping':
                try {
                    // Réaction immédiate avec une balle de ping-pong bleue
                    await sock.sendMessage(originalFrom, { react: { text: '🏓', key: m.key } });
                } catch (reactErr) {
                    // Log réduit
                }

                const start = Date.now();
                const end = Date.now();
                const speed = end - start;

                // Infos mémoire
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                const ram = Math.round(used * 100) / 100;

                const pongMsg = `PONG 🏓

⚡ Vitesse : ${speed} ms
🧠 RAM    : ${ram} MB
📡 Latence : ${speed} ms`;

                try {
                    const sentMsg = await sock.sendMessage(originalFrom, {
                        text: pongMsg
                    }, { quoted: m });

                    // Réaction rouge sur le message PONG
                    await sock.sendMessage(originalFrom, { react: { text: '🔴', key: sentMsg.key } });
                } catch (err) {
                    console.error('❌ ECHEC ENVOI PONG:', err.message || err);
                }
                break;

            case 'setprefix':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}setprefix <nouveau_prefixe>\nExemple: ${userPrefix}setprefix !`
                    }, { quoted: m });
                }
                const newPrefix = args[0];
                await UserConfig.upsert({ jid: from, prefix: newPrefix });
                await sock.sendMessage(originalFrom, {
                    text: successMessage('PRÉFIXE MODIFIÉ', `Votre nouveau préfixe est : ${toBold(newPrefix)}`, [
                        'Essayez .ping avec le nouveau préfixe'
                    ])
                }, { quoted: m });
                break;

            case 'setshortcut':
                if (args.length < 2) {
                    return sock.sendMessage(originalFrom, {
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

                    await sock.sendMessage(originalFrom, {
                        text: successMessage('RACCOURCI AJOUTÉ', `Trigger: ${trigger} → ${targetCmd}`, [
                            `Envoyez juste "${trigger}" pour lancer ${targetCmd}`
                        ])
                    }, { quoted: m });
                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(originalFrom, { text: errorMessage('Erreur Base de Données') }, { quoted: m });
                }
                break;

            case 'delshortcut':
                if (!args[0]) return sock.sendMessage(originalFrom, { text: `Usage: ${userPrefix}delshortcut <trigger>` }, { quoted: m });
                try {
                    const conf = await UserConfig.findOne({ where: { jid: from } });
                    if (conf) {
                        let shortcuts = JSON.parse(conf.shortcuts || '{}');
                        delete shortcuts[args[0]];
                        await UserConfig.update({ shortcuts: JSON.stringify(shortcuts) }, { where: { jid: from } });
                        await sock.sendMessage(originalFrom, { text: successMessage('RACCOURCI SUPPRIMÉ', `Le raccourci "${args[0]}" a été retiré.`) }, { quoted: m });
                    }
                } catch (e) { }
                break;

            case 'menu':
            case 'help':
                // 📋 Réaction OVL-style AVANT le menu
                await sock.sendMessage(originalFrom, { react: { text: '📋', key: m.key } });
                await new Promise(r => setTimeout(r, 300));

                // Passer le préfixe actuel à la génération du menu
                // On passe aussi les shortcuts pour l'affichage
                const currentConfig = {
                    ...CONFIG,
                    prefix: userPrefix,
                    customShortcuts: EMOJI_MAP
                };
                if (args[0]) {
                    const commandHelp = generateCommandHelp(args[0], currentConfig);
                    await sock.sendMessage(originalFrom, { text: commandHelp }, { quoted: m });
                } else {
                    const menu = generateHelpMenu(currentConfig);
                    await sock.sendMessage(originalFrom, { text: menu }, { quoted: m });
                }
                break;

            case 'save':
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    return sock.sendMessage(originalFrom, { text: errorMessage('ERREUR', 'Veuillez répondre à un statut ou une image !') }, { quoted: m });
                }
                const quotedMsgForSave = m.message.extendedTextMessage.contextInfo.quotedMessage;
                await handleSaveStatus(sock, m, quotedMsgForSave);
                break;

            case 'users':
                try {
                    // Filtrer uniquement les utilisateurs ACTIFS (non bannis)
                    const activeUsers = await UserConfig.findAll({ where: { banned: false } });
                    if (activeUsers.length === 0) {
                        return sock.sendMessage(originalFrom, {
                            text: infoMessage('👥 UTILISATEURS ACTIFS', 'Aucun utilisateur actif.')
                        }, { quoted: m });
                    }

                    let userList = `👥 *UTILISATEURS*\n\n`;

                    activeUsers.forEach((user, i) => {
                        const jid = user.jid.split('@')[0];
                        userList += `${i + 1}. @${jid}\n`;
                    });

                    userList += `\n━━━━━━━━━━━━━━━\n✅ ${activeUsers.length} actif(s)`;

                    await sock.sendMessage(originalFrom, { text: userList }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(originalFrom, {
                        text: errorMessage('Erreur récupération utilisateurs')
                    }, { quoted: m });
                }
                break;

            case 'ban':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}ban @utilisateur\n\nBannir un utilisateur du bot.`
                    }, { quoted: m });
                }
                try {
                    // Extraire le JID depuis la mention
                    const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!mentionedJid) {
                        return sock.sendMessage(originalFrom, {
                            text: errorMessage('ERREUR', 'Vous devez mentionner un utilisateur (@user)')
                        }, { quoted: m });
                    }

                    await UserConfig.upsert({
                        jid: mentionedJid,
                        banned: true,
                        bannedAt: new Date()
                    });

                    await sock.sendMessage(originalFrom, {
                        text: successMessage('UTILISATEUR BANNI', `@${mentionedJid.split('@')[0]} ne peut plus utiliser le bot.`)
                    }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(originalFrom, {
                        text: errorMessage('Erreur ban utilisateur')
                    }, { quoted: m });
                }
                break;

            case 'unban':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}unban @utilisateur\n\nDébannir un utilisateur du bot.`
                    }, { quoted: m });
                }
                try {
                    const mentionedJid = m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!mentionedJid) {
                        return sock.sendMessage(originalFrom, {
                            text: errorMessage('ERREUR', 'Vous devez mentionner un utilisateur (@user)')
                        }, { quoted: m });
                    }

                    await UserConfig.upsert({
                        jid: mentionedJid,
                        banned: false,
                        bannedAt: null
                    });

                    await sock.sendMessage(originalFrom, {
                        text: successMessage('UTILISATEUR DÉBANNI', `@${mentionedJid.split('@')[0]} peut à nouveau utiliser le bot.`)
                    }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(originalFrom, {
                        text: errorMessage('Erreur unban utilisateur')
                    }, { quoted: m });
                }
                break;

            case 'deluser':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}deluser <numéro>\n\nSupprimer un utilisateur de la base de données.\nExemple: ${userPrefix}deluser 1`
                    }, { quoted: m });
                }
                try {
                    const userNumber = parseInt(args[0]);
                    const activeUsers = await UserConfig.findAll({ where: { banned: false } });

                    if (userNumber < 1 || userNumber > activeUsers.length) {
                        return sock.sendMessage(originalFrom, {
                            text: errorMessage('NUMÉRO INVALIDE', `Choisissez un numéro entre 1 et ${activeUsers.length}`)
                        }, { quoted: m });
                    }

                    const userToDelete = activeUsers[userNumber - 1];
                    await UserConfig.destroy({ where: { jid: userToDelete.jid } });

                    await sock.sendMessage(originalFrom, {
                        text: successMessage('UTILISATEUR SUPPRIMÉ', `@${userToDelete.jid.split('@')[0]} a été retiré de la base.`)
                    }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(originalFrom, {
                        text: errorMessage('Erreur suppression utilisateur')
                    }, { quoted: m });
                }
                break;

            case 'vv':
                // 👁️ RÉCUPÉRATION VUE UNIQUE (Manuel)
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    return sock.sendMessage(originalFrom, { text: errorMessage('ERREUR', 'Répondez à une vue unique avec .vv') }, { quoted: m });
                }

                const quotedMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
                const viewOnceMsg = quotedMsg.viewOnceMessage || quotedMsg.viewOnceMessageV2;

                // 🔧 NETTOYER le message quoted de toutes ses métadonnées parasites
                // (forwarding info, contextInfo, etc.) qui créent les messages "Transféré..."
                const cleanMessage = (msg) => {
                    if (!msg) return msg;
                    const cleaned = { ...msg };
                    // Supprimer toutes les métadonnées
                    delete cleaned.contextInfo;
                    delete cleaned.forwardingScore;
                    delete cleaned.isForwarded;
                    return cleaned;
                };

                if (viewOnceMsg) {
                    const actualMsg = viewOnceMsg.message;
                    const cleanedActualMsg = cleanMessage(actualMsg);
                    await handleManualViewOnce(sock, m, cleanedActualMsg);
                } else {
                    // Nettoyer quotedMsg avant de le passer
                    const cleanedQuotedMsg = cleanMessage(quotedMsg);
                    await handleManualViewOnce(sock, m, cleanedQuotedMsg);
                }
                break;

            case 'autolike':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage Auto-Like :*\n\n${userPrefix}autolike on\n${userPrefix}autolike off\n${userPrefix}autolike emoji 💚`
                    }, { quoted: m });
                }

                if (args[0] === 'emoji' && args[1]) {
                    // Utiliser findOrCreate puis update pour garantir la modification
                    const [config] = await UserConfig.findOrCreate({
                        where: { jid: from },
                        defaults: { jid: from, likeEmoji: args[1] }
                    });
                    await config.update({ likeEmoji: args[1] });
                    await sock.sendMessage(originalFrom, {
                        text: successMessage('AUTO-LIKE', `Emoji modifié : ${args[1]}`)
                    }, { quoted: m });

                } else if (args[0] === 'on' || /\p{Emoji}/u.test(args[0])) {
                    const emoji = /\p{Emoji}/u.test(args[0]) ? args[0] : '💚';
                    await UserConfig.upsert({ jid: from, autoLikeStatus: true, likeEmoji: emoji });
                    await sock.sendMessage(originalFrom, {
                        text: successMessage('AUTO-LIKE ACTIVÉ', `Emoji : ${emoji}`)
                    }, { quoted: m });

                } else if (args[0] === 'off') {
                    await UserConfig.update({ autoLikeStatus: false }, { where: { jid: from } });
                    await sock.sendMessage(originalFrom, {
                        text: infoMessage('AUTO-LIKE DÉSACTIVÉ', ['Les statuts ne seront plus likés'])
                    }, { quoted: m });
                }
                break;


            case 'antidelete':
                if (!args[0]) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}antidelete all/pm/gc/status/off`
                    }, { quoted: m });
                }

                const mode = args[0];
                // FIX: Toujours cibler la config de l'OWNER (Global), pas celle du chat courant
                const ownerJidCfg = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                const [config, created] = await UserConfig.findOrCreate({ where: { jid: ownerJidCfg } });
                let settings = JSON.parse(config.antidelete || '{}');

                if (mode === 'off') {
                    settings = {};
                    await config.update({ antidelete: JSON.stringify(settings) });
                    await sock.sendMessage(originalFrom, { text: infoMessage('ANTI-DELETE OFF', ['Fonctionnalité désactivée globalement']) }, { quoted: m });
                } else if (['all', 'pm', 'gc', 'status'].includes(mode)) {
                    settings = { [mode]: true };
                    await config.update({ antidelete: JSON.stringify(settings) });
                    await sock.sendMessage(originalFrom, { text: successMessage('ANTI-DELETE ACTIVÉ', `Mode : ${mode}`) }, { quoted: m });
                }
                break;

            case 'dl':
                if (!q) return sock.sendMessage(originalFrom, { text: `📌 *Usage :* ${userPrefix}dl <lien>` }, { quoted: m });

                const targetJidDl = originalFrom;
                await sock.sendMessage(originalFrom, { react: { text: '⏳', key: m.key } });
                await sock.sendMessage(originalFrom, { text: `⬇️ *Téléchargement en cours...*` }, { quoted: m });

                let dlFile = null;
                try {
                    dlFile = await downloadWithYtdlp(q);
                    const caption = `⬇️ *Téléchargement Réussi*\n\n> 🔗 source: ${q}\n> © WBOT`;

                    if (dlFile.endsWith('.mp4') || dlFile.endsWith('.webm') || dlFile.endsWith('.mkv')) {
                        await sock.sendMessage(targetJidDl, { video: fs.readFileSync(dlFile), caption, gifPlayback: false });
                    } else {
                        await sock.sendMessage(targetJidDl, { image: fs.readFileSync(dlFile), caption });
                    }
                    await sock.sendMessage(originalFrom, { react: { text: '✅', key: m.key } });

                } catch (e) {
                    console.error('DL Error:', e);
                    const errTxt = errorMessage('ÉCHEC TÉLÉCHARGEMENT', e.message);
                    await sock.sendMessage(targetJidDl, { text: errTxt });
                    await sock.sendMessage(originalFrom, { react: { text: '❌', key: m.key } });
                } finally {
                    cleanupFile(dlFile);
                }
                break;

            case 'pp': // Get Profile Picture (Envoyer au propriétaire)
                try {
                    console.log('📸 Commande .pp démarrée...');

                    // 1. Définir le propriétaire (Destination)
                    const ownerDest = sock.user.id.split(':')[0] + '@s.whatsapp.net';

                    // 2. Identifier la Cible (De qui on veut la PP)
                    let targetJid = m.key.participant || from;
                    if (m.mentionedJid && m.mentionedJid[0]) {
                        targetJid = m.mentionedJid[0];
                    } else if (m.quoted) {
                        targetJid = m.quoted.participant || m.quoted.remoteJid;
                    }

                    // 3. Identifier la Source (D'où ça vient)
                    let sourceName = 'Discussion Privée';
                    if (from.endsWith('@g.us')) {
                        try {
                            const groupMetadata = await sock.groupMetadata(from);
                            sourceName = `Groupe: ${groupMetadata.subject}`;
                        } catch (e) {
                            sourceName = 'Groupe Inconnu';
                        }
                    } else {
                        // Discussion privée
                        sourceName = `Privé: ${from.split('@')[0]}`;
                    }

                    console.log(`🎯 PP de ${targetJid} demandée depuis ${sourceName}`);

                    await sock.sendMessage(originalFrom, { react: { text: '📸', key: m.key } });

                    let ppUrl;
                    try {
                        ppUrl = await sock.profilePictureUrl(targetJid, 'image');
                    } catch (e) {
                        return sock.sendMessage(originalFrom, { text: '❌ Pas de photo de profil (Privée ou inexistante).' }, { quoted: m });
                    }

                    if (!ppUrl) {
                        return sock.sendMessage(originalFrom, { text: '❌ Url photo vide.' }, { quoted: m });
                    }

                    // 4. Envoyer au PROPRIÉTAIRE (Message Sauvegardé)
                    await sock.sendMessage(ownerDest, {
                        image: { url: ppUrl },
                        caption: `🖼️ *Photo de Profil Sauvegardée*\n\n👤 *Cible* : @${targetJid.split('@')[0]}\n📂 *Source* : ${sourceName}\n\n> © WBOT`,
                        mentions: [targetJid]
                    });

                    // 5. Confirmer dans le chat d'origine (Discret)
                    await sock.sendMessage(originalFrom, { react: { text: '✅', key: m.key } });
                    // Optionnel : Petit message de confirmation
                    // await sock.sendMessage(originalFrom, { text: '✅ Photo envoyée dans votre messagerie.' }, { quoted: m });

                    console.log('\x1b[32m%s\x1b[0m', `✅ PP de ${targetJid} envoyée au propriétaire !`);

                } catch (e) {
                    console.error('❌ PP Error:', e);
                    sock.sendMessage(originalFrom, { text: '❌ Erreur interne .pp' }, { quoted: m });
                }
                break;

            case 'mp3':
                if (!q) return sock.sendMessage(originalFrom, { text: `📌 *Usage :* ${userPrefix}mp3 <lien>` }, { quoted: m });

                // 🕵️ Déterminer le destinataire
                const targetJidMp3 = originalFrom;

                await sock.sendMessage(originalFrom, { react: { text: '🎵', key: m.key } });

                await sock.sendMessage(originalFrom, {
                    text: `🎧 *Extraction Audio en cours...*`
                }, { quoted: m });

                let mp3File = null;
                try {
                    mp3File = await downloadAudioMp3(q);

                    await sock.sendMessage(targetJidMp3, {
                        audio: fs.readFileSync(mp3File),
                        mimetype: 'audio/mp4',
                        ptt: false, // Envoyer comme fichier audio, pas vocal
                        fileName: `audio_${Date.now()}.mp3`
                    });

                    await sock.sendMessage(originalFrom, { react: { text: '✅', key: m.key } });

                } catch (e) {
                    console.error('MP3 Error:', e);
                    await sock.sendMessage(targetJidMp3, { text: errorMessage('ÉCHEC MP3', e.message) });
                    await sock.sendMessage(originalFrom, { react: { text: '❌', key: m.key } });
                } finally {
                    cleanupFile(mp3File);
                }
                break;

            case 's':
            case 'sticker':
                // Doit répondre à une image/vidéo
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
                const isQuotedVideo = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

                if (!isQuotedImage && !isQuotedVideo) {
                    return sock.sendMessage(originalFrom, { text: '⚠️ Répondez à une image ou une vidéo pour créer un sticker.' }, { quoted: m });
                }

                const targetJidS = originalFrom;

                await sock.sendMessage(originalFrom, { react: { text: '🎨', key: m.key } });

                try {
                    const quotedM = m.message.extendedTextMessage.contextInfo.quotedMessage;
                    const buffer = await downloadMediaMessage(
                        { key: m.key, message: quotedM },
                        'buffer',
                        {},
                        { logger: console }
                    );

                    const sticker = new Sticker(buffer, {
                        pack: 'WBOT Stickers',
                        author: CONFIG.ownerName,
                        type: StickerTypes.FULL,
                        quality: 70
                    });

                    const stickerBuffer = await sticker.toBuffer();

                    // Envoyer le sticker DANS la discussion
                    await sock.sendMessage(targetJidS, { sticker: stickerBuffer }, { quoted: m });
                    await sock.sendMessage(originalFrom, { react: { text: '✅', key: m.key } });

                } catch (e) {
                    console.error('Sticker Error:', e);
                    await sock.sendMessage(targetJidS, { text: errorMessage('ÉCHEC STICKER', e.message) });
                    await sock.sendMessage(originalFrom, { react: { text: '❌', key: m.key } });
                }
                break;
            // --- INTELLIGENCE ARTIFICIELLE ---


            case 'settagemoji':
                // Check Owner
                if (!m.key.fromMe) return sock.sendMessage(from, { text: '⛔ Commande réservée au propriétaire.' }, { quoted: m });

                if (!q) return sock.sendMessage(from, { text: '📌 Usage: .settagemoji <emoji>\nExemple: .settagemoji 📣' }, { quoted: m });

                const newEmoji = q.trim().split(' ')[0]; // Prendre le premier caractère/emoji
                if (!newEmoji) return sock.sendMessage(from, { text: '❌ Emoji invalide.' }, { quoted: m });

                try {
                    const myJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    // Mettre à jour la config du propriétaire
                    await UserConfig.upsert({
                        jid: myJid,
                        isOwner: true,
                        tagAllEmoji: newEmoji
                    });

                    await sock.sendMessage(from, { text: `✅ L'emoji de tag a été mis à jour sur : ${newEmoji}` }, { quoted: m });
                } catch (e) {
                    console.error('SetTagEmoji Error:', e);
                    await sock.sendMessage(from, { text: '❌ Erreur base de données.' }, { quoted: m });
                }
                break;
            case 'tagall':
            case 'admin':
                // 1. Check Group
                if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: '⚠️ Commande réservée aux groupes.' }, { quoted: m });

                // 2. Check Owner (fromMe)
                if (!m.key.fromMe) return sock.sendMessage(from, { text: '⛔ Accès refusé (Owner uniquement).' }, { quoted: m });

                // Récupérer l'emoji custom pour l'affichage
                let tagEmoji = '📢'; // Défaut
                try {
                    const myJidTag = sock.user.id.split(':')[0] + '@s.whatsapp.net';
                    const configTag = await UserConfig.findOne({ where: { jid: myJidTag } });
                    if (configTag && configTag.tagAllEmoji) tagEmoji = configTag.tagAllEmoji;
                } catch (e) { }

                // FEEDBACK IMMÉDIAT (Comme demandé)
                await sock.sendMessage(from, { react: { text: tagEmoji, key: m.key } });

                await handleTagAll(sock, from, m, q, tagEmoji);
                break;

            case 'ask':
            case 'gpt':
            case 'gemini':
            case 'ai':
                if (!q) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}${command} <question>\n\nExemple:\n${userPrefix}ask Quelle est la capitale de la France ?\n${userPrefix}gemini Explique-moi le quantique`
                    }, { quoted: m });
                }

                await sock.sendMessage(originalFrom, { react: { text: '🤖', key: m.key } });

                try {
                    console.log(`🤖 Question IA reçue (${command}): ${q}`);
                    const aiRes = await askGemini(q);

                    if (!aiRes || !aiRes.trim()) {
                        throw new Error('Réponse vide de l\'IA');
                    }

                    console.log(`🤖 Réponse IA: ${aiRes.substring(0, 100)}...`);

                    // Vérifier si c'est une erreur
                    if (aiRes.startsWith('⚠️')) {
                        await sock.sendMessage(originalFrom, {
                            text: `❌ ${aiRes}\n\n💡 Vérifiez que la clé API Gemini est configurée dans les variables d'environnement (GEMINI_API_KEY).`
                        }, { quoted: m });
                    } else {
                        await sock.sendMessage(originalFrom, {
                            text: `🤖 *Réponse :*\n\n${aiRes}`
                        }, { quoted: m });
                    }
                } catch (e) {
                    console.error('❌ Erreur IA:', e);
                    await sock.sendMessage(originalFrom, {
                        text: `❌ Erreur IA: ${e.message || 'Erreur inconnue'}\n\n💡 Vérifiez votre clé API Gemini (GEMINI_API_KEY)`
                    }, { quoted: m });
                }
                break;

            case 'what':
            case 'vision':
                // Doit répondre à une image
                const quotedMsgVision = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedKey = m.message.extendedTextMessage?.contextInfo?.stanzaId
                    ? {
                        remoteJid: m.message.extendedTextMessage.contextInfo.remoteJid || originalFrom,
                        id: m.message.extendedTextMessage.contextInfo.stanzaId,
                        fromMe: false
                    }
                    : null;

                if (!quotedMsgVision) {
                    return sock.sendMessage(originalFrom, {
                        text: `📌 *Usage :* ${userPrefix}what <question>\n\n⚠️ Répondez à une image avec cette commande.\n\nExemple:\n${userPrefix}what Que vois-tu sur cette image ?\n${userPrefix}what Décris cette photo`
                    }, { quoted: m });
                }

                // Vérifier si c'est une image ou une vidéo
                const targetImg = quotedMsgVision.imageMessage || quotedMsgVision.videoMessage;
                if (!targetImg) {
                    return sock.sendMessage(originalFrom, {
                        text: `⚠️ Veuillez répondre à une image ou une vidéo avec ${userPrefix}what\n\nLa commande ne fonctionne qu'avec des images ou vidéos.`
                    }, { quoted: m });
                }

                await sock.sendMessage(originalFrom, { react: { text: '👀', key: m.key } });

                try {
                    console.log(`👀 Analyse d'image demandée: ${q || 'Description automatique'}`);

                    // Construire la clé correcte pour télécharger le média
                    const downloadKey = quotedKey || {
                        remoteJid: originalFrom,
                        id: m.message.extendedTextMessage.contextInfo.stanzaId || m.key.id,
                        fromMe: false
                    };

                    const imgBuffer = await downloadMediaMessage(
                        { key: downloadKey, message: quotedMsgVision },
                        'buffer',
                        {},
                        { logger: console }
                    );

                    if (!imgBuffer || imgBuffer.length === 0) {
                        throw new Error('Impossible de télécharger l\'image. Le buffer est vide.');
                    }

                    console.log(`✅ Image téléchargée: ${imgBuffer.length} bytes`);

                    const promptVision = q || "Décris cette image en détail. Que vois-tu ?";
                    console.log(`👀 Envoi à Gemini Vision avec prompt: ${promptVision}`);

                    const visionRes = await analyzeImageWithGemini(imgBuffer, promptVision);

                    if (!visionRes || visionRes.trim().length === 0) {
                        throw new Error('Réponse vide de l\'IA');
                    }

                    if (visionRes.startsWith('⚠️')) {
                        throw new Error(visionRes);
                    }

                    console.log(`✅ Réponse reçue: ${visionRes.substring(0, 100)}...`);
                    await sock.sendMessage(originalFrom, {
                        text: `🤖 *Analyse de l'image :*\n\n${visionRes}`
                    }, { quoted: m });
                } catch (e) {
                    console.error('❌ Vision Error:', e);
                    const errorMsg = e.message || 'Erreur inconnue';
                    await sock.sendMessage(originalFrom, {
                        text: `❌ Erreur analyse image: ${errorMsg}\n\n💡 Vérifiez que:\n- L'image est valide\n- Votre clé API Gemini est configurée\n- L'image n'est pas trop grande`
                    }, { quoted: m });
                }
                break;

            case 'summary':
                if (!m.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                    return sock.sendMessage(originalFrom, { text: '⚠️ Répondez à un texte pour le résumer.' }, { quoted: m });
                }

                const quotedText = m.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
                    m.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text;

                if (!quotedText) return sock.sendMessage(originalFrom, { text: '❌ Pas de texte trouvé dans le message cité.' }, { quoted: m });

                await sock.sendMessage(originalFrom, { react: { text: '📝', key: m.key } });

                const summaryPrompt = `Fais un résumé ultra-concis et structuré de ce texte :\n\n"${quotedText}"`;
                const summaryRes = await askGemini(summaryPrompt);

                await sock.sendMessage(originalFrom, { text: `📝 *Résumé :*\n${summaryRes}` }, { quoted: m });
                break;

            case 'img':
            case 'imagine':
                if (!q) return sock.sendMessage(originalFrom, { text: `🎨 *Usage :* ${userPrefix}img <description>` }, { quoted: m });

                await sock.sendMessage(originalFrom, { react: { text: '🎨', key: m.key } });

                try {
                    // Pollinations.ai (Gratuit, Rapide, Bonne qualité)
                    const encodedPrompt = encodeURIComponent(q);
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

                    await sock.sendMessage(originalFrom, {
                        image: { url: imageUrl },
                        caption: `🎨 *Image générée :* ${q}\n> © Gemini Bot`
                    }, { quoted: m });
                } catch (e) {
                    await sock.sendMessage(originalFrom, { text: '❌ Erreur génération image.' }, { quoted: m });
                }
                break;
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
 * FEATURE: Auto-Like (LOGIQUE OVL ROBUSTE)
 * - Supporte LID & Phone JID pour la config
 * - Logique: Read -> Wait -> React
 */
async function handleAutoLike(sock, m) {
    try {
        const myIdRaw = sock.user.id.split(':')[0];

        // 1. Config Check (RECHERCHE LARGE)
        // On cherche N'IMPORTE QUELLE config active (puisque c'est un bot perso)
        // Cela résout définitivement le problème LID vs Phone JID
        const config = await UserConfig.findOne({
            where: { autoLikeStatus: true },
            order: [['updatedAt', 'DESC']]
        });

        if (!config) {
            console.log(`🔎 AutoLike: Aucune config active trouvée. (Activez avec .autolike on)`);
            return;
        }

        const emoji = config.likeEmoji || '💚';
        console.log(`💚 AutoLike: Config Chargée pour ${config.jid} (Emoji: ${emoji})`);



        // 2. Author Check
        const author = m.key.participant || m.participant;

        // Security checks
        if (!author) {
            console.log('⚠️ AutoLike: Auteur manquant');
            return;
        }

        // Eviter boucle (Liker son propre statut)
        // On vérifie si l'auteur est moi (Phone ou LID)
        const isMe = m.key.fromMe || author.includes(myIdRaw);
        if (isMe) {
            console.log('ℹ️ AutoLike: Ignoré (C\'est moi)');
            return;
        }

        console.log(`✅ AutoLike: Cible validée -> ${author.split('@')[0]}`);

        // 3. LOGIQUE OVL: MARQUER LU (Force Sync)
        await sock.readMessages([m.key]);

        // 4. TIMEOUT (Humaniser)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 5. REACT (OVL Style: Distribution Forcée)
        // On envoie la réaction sur le JID 'status@broadcast'
        // Mais on force la distribution à soi-même (sock.user.id) pour que le téléphone le voie
        // Et à l'auteur pour qu'il le reçoive
        await sock.sendMessage('status@broadcast', {
            react: {
                text: emoji,
                key: m.key
            }
        }, {
            statusJidList: [author, sock.user.id, myIdRaw + '@s.whatsapp.net'] // Triple sécurité pour la sync
        });

        console.log(`💚 AutoLike OVL: ${emoji} envoyé à ${author.split('@')[0]}`);

    } catch (e) {
        console.error('❌ AutoLike Error:', e.message);
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

        // ✅ Réactions dans le chat original (pour confirmation visuelle)
        await sock.sendMessage(m.key.remoteJid, { react: { text: '⏳', key: m.key } });

        // Télécharger
        const buffer = await downloadMediaMessage(
            { key: m.key, message: viewOnceMessageContent },
            'buffer',
            {},
            { logger: undefined }
        );

        // 🔧 FIX: Cibler correctement "Notes à moi-même"
        // sock.user.id peut être au format LID ou Phone. On nettoie tout.
        const myJid = sock.user.id.split(':')[0].split('@')[0] + '@s.whatsapp.net';


        console.log(`👁️ Envoi Vue Unique vers: ${myJid}`);

        // 🔧🔧 ENVOI ULTRA-PROPRE : AUCUNE option, juste le contenu
        if (type === 'videoMessage') {
            await sock.sendMessage(myJid, {
                video: buffer,
                caption: '👁️ *Vue Unique Récupérée*'
            });
        } else if (type === 'imageMessage') {
            await sock.sendMessage(myJid, {
                image: buffer,
                caption: '👁️ *Vue Unique Récupérée*'
            });
        } else if (type === 'audioMessage') {
            await sock.sendMessage(myJid, {
                audio: buffer,
                mimetype: 'audio/mp4',
                ptt: true
            });
        }

        // ✅ Confirmation finale
        await sock.sendMessage(m.key.remoteJid, { react: { text: '✅', key: m.key } });
        console.log('👁️ Vue unique récupérée via .vv !');

    } catch (e) {
        console.error('VV Error:', e);
        await sock.sendMessage(m.key.remoteJid, { text: '❌ Erreur récupération : ' + e.message }, { quoted: m });
    }
}

/**
 * Fonction TagAll Global (Exportée pour Reaction)
 */
export async function handleTagAll(sock, from, quotedMsg, text = '') {
    try {
        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants.map(p => p.id);

        const emoji = '📢';
        const title = text || 'Annonce Générale';

        let messageText = `${emoji} *${title}*\n\n`;
        messageText += `👥 *Membres:* ${participants.length}\n`;
        messageText += `──────────────────\n`;

        // Ajouter les mentions invisibles ou visibles (ici stylisé)
        for (let mem of participants) {
            messageText += `➥ @${mem.split('@')[0]}\n`;
        }

        messageText += `──────────────────\n`;
        messageText += `🤖 *WBOT TagSystem*`;

        await sock.sendMessage(from, {
            text: messageText,
            mentions: participants
        }, { quoted: quotedMsg });

    } catch (e) {
        console.error('❌ TagAll Error:', e);
        await sock.sendMessage(from, { text: '❌ Erreur TagAll (Le bot est-il admin ?)' });
    }
}
