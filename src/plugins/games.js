/**
 * 🎮 JEUX SIMPLES OVL-STYLE
 * Dice, Slot Machine, Rock-Paper-Scissors
 */

/**
 * .dice - Lance un dé
 */
export async function handleDice(sock, m, from) {
    const result = Math.floor(Math.random() * 6) + 1;
    const diceEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][result - 1];

    await sock.sendMessage(from, {
        text: `🎲 *Lancer de dé*\n\n${diceEmoji} Tu as obtenu : *${result}*`
    }, { quoted: m });
}

/**
 * .slot - Machine à sous
 */
export async function handleSlot(sock, m, from) {
    const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
    const s1 = symbols[Math.floor(Math.random() * symbols.length)];
    const s2 = symbols[Math.floor(Math.random() * symbols.length)];
    const s3 = symbols[Math.floor(Math.random() * symbols.length)];

    const isWin = (s1 === s2 && s2 === s3);
    const result = isWin ? '🎊 *JACKPOT !* 🎊' : '❌ Perdu... Retente ta chance !';

    await sock.sendMessage(from, {
        text: `🎰 *MACHINE À SOUS*\n\n[ ${s1} | ${s2} | ${s3} ]\n\n${result}`
    }, { quoted: m });
}

/**
 * .rps - Pierre Feuille Ciseaux
 */
export async function handleRPS(sock, m, args, from) {
    const choices = ['pierre', 'feuille', 'ciseaux'];
    const emojis = { pierre: '🪨', feuille: '📄', ciseaux: '✂️' };

    const userChoice = args[0]?.toLowerCase();
    if (!choices.includes(userChoice)) {
        return sock.sendMessage(from, {
            text: '❌ Choix invalide !\n\nUtilise: `.rps pierre`, `.rps feuille` ou `.rps ciseaux`'
        }, { quoted: m });
    }

    const botChoice = choices[Math.floor(Math.random() * choices.length)];

    let result;
    if (userChoice === botChoice) {
        result = '🤝 Égalité !';
    } else if (
        (userChoice === 'pierre' && botChoice === 'ciseaux') ||
        (userChoice === 'feuille' && botChoice === 'pierre') ||
        (userChoice === 'ciseaux' && botChoice === 'feuille')
    ) {
        result = '🎉 Tu gagnes !';
    } else {
        result = '😅 Je gagne !';
    }

    await sock.sendMessage(from, {
        text: `🎮 *PIERRE FEUILLE CISEAUX*\n\nToi: ${emojis[userChoice]} ${userChoice}\nMoi: ${emojis[botChoice]} ${botChoice}\n\n${result}`
    }, { quoted: m });
}
