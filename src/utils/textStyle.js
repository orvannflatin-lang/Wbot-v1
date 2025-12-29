/**
 * Utilitaire pour styliser le texte des messages du bot
 * Utilise des caractères Unicode spéciaux pour un rendu élégant
 */

// Caractères Unicode spéciaux pour styliser le texte
const FONTS = {
    // Petit caps élégant
    smallCaps: {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ',
        'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ',
        'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x',
        'y': 'ʏ', 'z': 'ᴢ'
    },

    // Bold (utilise les caractères mathématiques)
    bold: {
        'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵',
        'i': '𝗶', 'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽',
        'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅',
        'y': '𝘆', 'z': '𝘇',
        'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛',
        'I': '𝗜', 'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣',
        'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫',
        'Y': '𝗬', 'Z': '𝗭'
    }
};

// Emojis pour décorer les messages
const EMOJIS = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳',
    done: '✨',
    fire: '🔥',
    ghost: '👻',
    heart: '💚',
    settings: '⚙️',
    delete: '🗑️',
    save: '💾',
    lock: '🔒',
    unlock: '🔓',
    menu: '📋',
    arrow: '➜',
    bullet: '߷',
    star: '⭐',
    crown: '👑'
};

/**
 * Convertit du texte en small caps
 */
export function toSmallCaps(text) {
    return text.split('').map(char => {
        return FONTS.smallCaps[char.toLowerCase()] || char;
    }).join('');
}

/**
 * Convertit du texte en bold
 */
export function toBold(text) {
    return text.split('').map(char => {
        return FONTS.bold[char] || char;
    }).join('');
}

/**
 * Crée un en-tête stylisé
 */
export function createHeader(title, emoji = '✨') {
    return `╭───〔 ${emoji} ${toBold(title.toUpperCase())} 〕───⬣\n│`;
}

/**
 * Crée un pied stylisé
 */
export function createFooter() {
    return `╰──────────────────⬣`;
}

/**
 * Crée une ligne de menu
 */
export function createMenuItem(command, description, emoji = '•') {
    return `│ ${emoji} ${toBold(command)} ${EMOJIS.arrow} ${description}`;
}

/**
 * Crée une section de menu
 */
export function createSection(title, items = []) {
    let section = `│\n│ ${toBold('━━ ' + title.toUpperCase() + ' ━━')}\n│\n`;
    items.forEach(item => {
        section += `${item}\n`;
    });
    return section;
}

/**
 * Crée un message de succès stylisé
 */
export function successMessage(title, description = '', details = []) {
    let msg = `${EMOJIS.success} *${toBold(title)}*\n\n`;
    if (description) msg += `${description}\n`;
    if (details.length > 0) {
        msg += '\n';
        details.forEach(detail => {
            msg += `${EMOJIS.bullet} ${detail}\n`;
        });
    }
    return msg;
}

/**
 * Crée un message d'erreur stylisé
 */
export function errorMessage(title, description = '') {
    let msg = `${EMOJIS.error} *${toBold(title)}*\n`;
    if (description) msg += `\n${description}`;
    return msg;
}

/**
 * Crée un message d'information stylisé
 */
export function infoMessage(title, items = []) {
    let msg = `${EMOJIS.info} *${toBold(title)}*\n\n`;
    items.forEach(item => {
        msg += `${EMOJIS.arrow} ${item}\n`;
    });
    return msg;
}

/**
 * Crée un cadre élégant
 */
export function createBox(content) {
    const lines = content.split('\n');
    let box = '╭' + '─'.repeat(50) + '╮\n';
    lines.forEach(line => {
        box += `│ ${line.padEnd(48)} │\n`;
    });
    box += '╰' + '─'.repeat(50) + '╯';
    return box;
}

export { EMOJIS };
