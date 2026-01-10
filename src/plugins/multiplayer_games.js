/**
 * 🎮 JEUX MULTIJOUEURS OVL-STYLE - VERSION AMÉLIORÉE
 * Reply-based interactions + sessions multiples
 */

const activeGames = new Map();

/**
 * .ttt - Tic-Tac-Toe avec REPLY
 */
export async function handleTicTacToe(sock, m, args, from) {
    const gameKey = from;
    const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    console.log(`🎮 TTT DEBUG: gameKey=${gameKey}, isReply=${!!isReply}, args=${JSON.stringify(args)}`);

    if (!activeGames.has(gameKey) && !isReply) {
        console.log(`🎮 TTT: Création nouvelle partie`);
        activeGames.set(gameKey, {
            type: 'ttt',
            board: Array(9).fill(null),
            currentPlayer: 'X',
            players: { X: m.key.participant || m.key.remoteJid, O: null },
            lastMsgId: null
        });

        const board = renderTTTBoard(Array(9).fill(null));
        const sent = await sock.sendMessage(from, {
            text: `🎮 *TIC-TAC-TOE LANCÉ !*\n\n${board}\n\n❌ ${m.pushName} commence (X)\n⭕ Un autre joueur peut reply avec 1-9 pour rejoindre !\n\n💡 Reply à ce message avec un chiffre 1-9 pour jouer`
        }, { quoted: m });

        const game = activeGames.get(gameKey);
        game.lastMsgId = sent.key.id;
        console.log(`🎮 TTT: Partie créée, msgId=${sent.key.id}`);
        return;
    }

    // Rejoindre ou jouer via REPLY
    if (isReply) {
        const game = activeGames.get(gameKey);
        console.log(`🎮 TTT REPLY: game exists=${!!game}`);

        if (!game) {
            console.log(`⚠️ TTT: Aucune partie active pour ${gameKey}`);
            return;
        }

        const move = parseInt(args[0]) - 1;
        console.log(`🎮 TTT: move parsed=${move} from args[0]=${args[0]}`);

        if (isNaN(move) || move < 0 || move > 8) {
            console.log(`❌ TTT: Move invalide`);
            return;
        }

        const playerJid = m.key.participant || m.key.remoteJid;
        console.log(`🎮 TTT: playerJid=${playerJid}, X=${game.players.X}, O=${game.players.O}`);

        // Rejoindre comme O
        if (game.players.O === null && playerJid !== game.players.X) {
            game.players.O = playerJid;
            console.log(`⭕ TTT: ${m.pushName} rejoint comme O`);
        }

        const symbol = playerJid === game.players.X ? 'X' : (playerJid === game.players.O ? 'O' : null);
        console.log(`🎮 TTT: symbol=${symbol}, currentPlayer=${game.currentPlayer}, board[${move}]=${game.board[move]}`);

        if (!symbol || symbol !== game.currentPlayer || game.board[move] !== null) {
            console.log(`❌ TTT: Coup refusé - symbol=${symbol}, currentPlayer=${game.currentPlayer}, occupied=${game.board[move] !== null}`);
            return;
        }

        console.log(`✅ TTT: Coup accepté - ${symbol} joue case ${move + 1}`);
        game.board[move] = symbol;
        const winner = checkTTTWinner(game.board);
        const board = renderTTTBoard(game.board);

        if (winner) {
            await sock.sendMessage(from, {
                text: `🎊 *${winner} GAGNE !* 🎊\n\n${board}\n\n🏆 Bravo !`
            });
            activeGames.delete(gameKey);
        } else if (!game.board.includes(null)) {
            await sock.sendMessage(from, {
                text: `🤝 *ÉGALITÉ !*\n\n${board}`
            });
            activeGames.delete(gameKey);
        } else {
            game.currentPlayer = symbol === 'X' ? 'O' : 'X';
            const nextSymbol = game.currentPlayer === 'X' ? '❌' : '⭕';
            const sent = await sock.sendMessage(from, {
                text: `${board}\n\nC'est au tour de ${nextSymbol}\n\n💡 Reply avec 1-9`
            });
            game.lastMsgId = sent.key.id;
        }
    }
}

function renderTTTBoard(board) {
    const symbols = board.map((cell, i) => cell || (i + 1));
    return `┏━━━┳━━━┳━━━┓
┃ ${symbols[0]} ┃ ${symbols[1]} ┃ ${symbols[2]} ┃
┣━━━╋━━━╋━━━┫
┃ ${symbols[3]} ┃ ${symbols[4]} ┃ ${symbols[5]} ┃
┣━━━╋━━━╋━━━┫
┃ ${symbols[6]} ┃ ${symbols[7]} ┃ ${symbols[8]} ┃
┗━━━┻━━━┻━━━┛`;
}

function checkTTTWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

/**
 * .truth - Truth or Dare pour GROUPES
 * Usage: .truth @user pour cibler quelqu'un
 */
export async function handleTruthOrDare(sock, m, args, from) {
    const truths = [
        "Quel est ton plus gros secret ?",
        "Qui est ton crush ?",
        "Quelle est la chose la plus embarrassante ?",
        "As-tu déjà menti à tes parents ?",
        "Quelle est ta plus grande peur ?",
        "Si tu pouvais effacer un souvenir, lequel ?",
        "Dernière chose que tu as googler ?",
        "As-tu déjà triché à un examen ?",
        "Pire chose faite à un ami ?",
        "Si tu devais embrasser quelqu'un ici, qui ?"
    ];

    const dares = [
        "Envoie un message à ton crush",
        "Change ta photo de profil embarrassante 24h",
        "Appelle et chante à quelqu'un",
        "Vocal en imitant quelqu'un",
        "Avoue une chose que personne ne sait",
        "20 pompes et envoie vidéo",
        "Poème d'amour pour quelqu'un du groupe",
        "Statut ridicule",
        "Danse devant caméra",
        "Dis à la dernière personne que tu l'aimes"
    ];

    const isTruth = Math.random() > 0.5;
    const question = isTruth ?
        truths[Math.floor(Math.random() * truths.length)] :
        dares[Math.floor(Math.random() * dares.length)];

    const type = isTruth ? '🤔 *VÉRITÉ*' : '🔥 *ACTION*';

    // Cibler quelqu'un si mentionné, sinon la personne qui lance
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const targetJid = (mentioned && mentioned[0]) || m.key.participant || m.key.remoteJid;

    await sock.sendMessage(from, {
        text: `${type}\n\n${question}\n\n@${targetJid.split('@')[0]} doit répondre/faire !`,
        mentions: [targetJid]
    }, { quoted: m });
}

/**
 * .ship - Compatibilité
 */
export async function handleShip(sock, m, args, from) {
    const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid;

    if (!mentioned || mentioned.length < 2) {
        return sock.sendMessage(from, {
            text: '❌ Mentionne 2 personnes !\n\nEx: .ship @user1 @user2'
        }, { quoted: m });
    }

    const user1 = mentioned[0];
    const user2 = mentioned[1];

    const combined = [user1, user2].sort().join('');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = ((hash << 5) - hash) + combined.charCodeAt(i);
        hash &= hash;
    }
    const percent = Math.abs(hash % 101);

    const hearts = percent > 75 ? '💖💖💖💖💖' :
        percent > 50 ? '💖💖💖💖' :
            percent > 25 ? '💖💖💖' :
                percent > 10 ? '💖💖' : '💖';

    const verdict = percent > 80 ? '🔥 PARFAIT !' :
        percent > 60 ? '💕 Très bien !' :
            percent > 40 ? '😊 Possible !' :
                percent > 20 ? '😐 Bof...' : '💔 Oublie...';

    await sock.sendMessage(from, {
        text: `💘 *SHIP*\n\n${user1.split('@')[0]} 💕 ${user2.split('@')[0]}\n\n${hearts}\n\n*${percent}%*\n\n${verdict}`,
        mentions: mentioned
    }, { quoted: m });
}

/**
 * .guess - Deviner nombre
 */
export async function handleGuess(sock, m, args, from) {
    const gameKey = `guess_${from}`;
    const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!activeGames.has(gameKey) && !isReply) {
        const targetNumber = Math.floor(Math.random() * 100) + 1;
        activeGames.set(gameKey, {
            type: 'guess',
            number: targetNumber,
            attempts: 0,
            maxAttempts: 10
        });

        await sock.sendMessage(from, {
            text: `🎯 *DEVINEZ LE NOMBRE !*\n\nEntre 1 et 100\n10 essais !\n\n💡 Reply avec ton nombre`
        }, { quoted: m });
        return;
    }

    if (isReply) {
        const game = activeGames.get(gameKey);
        if (!game) return;

        const guess = parseInt(m.message.extendedTextMessage.text.trim());
        if (isNaN(guess) || guess < 1 || guess > 100) return;

        game.attempts++;
        const remaining = game.maxAttempts - game.attempts;

        if (guess === game.number) {
            await sock.sendMessage(from, {
                text: `🎊 *BRAVO ${m.pushName} !*\n\nTrouvé ${game.number} en ${game.attempts} essai(s) !`
            });
            activeGames.delete(gameKey);
        } else if (game.attempts >= game.maxAttempts) {
            await sock.sendMessage(from, {
                text: `💀 *GAME OVER !*\n\nC'était ${game.number}`
            });
            activeGames.delete(gameKey);
        } else {
            const hint = guess < game.number ? '📈 Plus haut !' : '📉 Plus bas !';
            await sock.sendMessage(from, {
                text: `${hint}\n\n${m.pushName}: ${guess}\n\n⏱️ ${remaining} essais restants\n\n💡 Reply pour continuer`
            });
        }
    }
}

/**
 * .riddle - Devinette
 */
export async function handleRiddle(sock, m, args, from) {
    const riddles = [
        { q: "Je suis pris avant d'être donné, utilisé après être brisé. Qui ?", a: "Un œuf" },
        { q: "Plus tu m'enlèves, plus je deviens grand. Qui ?", a: "Un trou" },
        { q: "Je vole sans ailes, pleure sans yeux. Qui ?", a: "Un nuage" },
        { q: "Plus je suis chaud, plus je suis frais. Qui ?", a: "Le pain" },
        { q: "Je commence la nuit et termine le matin. Qui ?", a: "N" },
        { q: "Villes sans maisons, forêts sans arbres. Qui ?", a: "Une carte" },
        { q: "Plus tu en prends, plus tu en laisses. Qui ?", a: "Des pas" },
        { q: "Je cours mais ne marche jamais. Qui ?", a: "Une rivière" },
        { q: "Monte mais ne descend jamais ?", a: "L'âge" },
        { q: "Léger comme plume mais personne ne tient 5min. Qui ?", a: "Le souffle" }
    ];

    const gameKey = `riddle_${from}`;

    if (!activeGames.has(gameKey)) {
        const riddle = riddles[Math.floor(Math.random() * riddles.length)];
        activeGames.set(gameKey, {
            type: 'riddle',
            riddle: riddle
        });

        await sock.sendMessage(from, {
            text: `🧩 *DEVINETTE*\n\n${riddle.q}\n\n💡 Reply ta réponse ou .riddle answer`
        }, { quoted: m });

        setTimeout(async () => {
            if (activeGames.has(gameKey)) {
                const game = activeGames.get(gameKey);
                await sock.sendMessage(from, {
                    text: `⏰ *TEMPS ÉCOULÉ !*\n\nRéponse : *${game.riddle.a}*`
                });
                activeGames.delete(gameKey);
            }
        }, 120000);
        return;
    }

    if (args[0] === 'answer') {
        const game = activeGames.get(gameKey);
        if (game) {
            await sock.sendMessage(from, {
                text: `💡 *RÉPONSE*\n\n${game.riddle.a}`
            });
            activeGames.delete(gameKey);
        }
    }
}

/**
 * .quiz - Quiz avec SERIES de questions
 * Usage: .quiz ou .quiz 10 pour 10 questions
 */
export async function handleQuiz(sock, m, args, from) {
    const questions = [
        { q: "Capitale de la France ?", options: ["Paris", "Lyon", "Marseille"], correct: 0 },
        { q: "Combien de continents ?", options: ["5", "6", "7"], correct: 2 },
        { q: "Qui a peint la Joconde ?", options: ["Picasso", "De Vinci", "Van Gogh"], correct: 1 },
        { q: "Plus grand océan ?", options: ["Atlantique", "Indien", "Pacifique"], correct: 2 },
        { q: "Joueurs dans une équipe de foot ?", options: ["10", "11", "12"], correct: 1 },
        { q: "Planète plus proche du Soleil ?", options: ["Vénus", "Mercure", "Mars"], correct: 1 },
        { q: "Homme sur la Lune en ?", options: ["1969", "1972", "1965"], correct: 0 },
        { q: "Symbole chimique de l'or ?", options: ["Au", "Ag", "Fe"], correct: 0 },
        { q: "Côtés d'un hexagone ?", options: ["5", "6", "7"], correct: 1 },
        { q: "Langue la plus parlée ?", options: ["Anglais", "Mandarin", "Espagnol"], correct: 1 },
        { q: "Auteur de Harry Potter ?", options: ["Tolkien", "Rowling", "Martin"], correct: 1 },
        { q: "Capitale du Japon ?", options: ["Osaka", "Kyoto", "Tokyo"], correct: 2 },
        { q: "Mont le plus haut ?", options: ["K2", "Everest", "Kilimandjaro"], correct: 1 },
        { q: "Planètes dans le système solaire ?", options: ["8", "9", "10"], correct: 0 },
        { q: "Inventeur de l'ampoule ?", options: ["Tesla", "Edison", "Bell"], correct: 1 }
    ];

    const gameKey = `quiz_${from}`;
    const isReply = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // Démarrer série
    if (!activeGames.has(gameKey) && !isReply) {
        const totalQuestions = parseInt(args[0]) || 1;
        const maxQuestions = Math.min(totalQuestions, 15);

        activeGames.set(gameKey, {
            type: 'quiz',
            questions: questions.sort(() => 0.5 - Math.random()).slice(0, maxQuestions),
            currentIndex: 0,
            score: 0,
            total: maxQuestions
        });

        const game = activeGames.get(gameKey);
        const q = game.questions[0];
        const optionsText = q.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

        await sock.sendMessage(from, {
            text: `📚 *QUIZ CULTURE G*\n🎯 ${game.total} question(s)\n\n❓ Question 1/${game.total}\n\n${q.q}\n\n${optionsText}\n\n💡 Reply 1, 2 ou 3`
        }, { quoted: m });

        setTimeout(async () => {
            if (activeGames.has(gameKey)) {
                const g = activeGames.get(gameKey);
                await sock.sendMessage(from, {
                    text: `⏰ *TEMPS ÉCOULÉ !*\n\nScore final : ${g.score}/${g.total}`
                });
                activeGames.delete(gameKey);
            }
        }, 120000);
        return;
    }

    // Répondre
    if (isReply) {
        const game = activeGames.get(gameKey);
        if (!game) return;

        const answer = parseInt(m.message.extendedTextMessage.text.trim()) - 1;
        const currentQ = game.questions[game.currentIndex];

        if (answer === currentQ.correct) {
            game.score++;
            game.currentIndex++;

            if (game.currentIndex >= game.total) {
                await sock.sendMessage(from, {
                    text: `🎉 *TERMINÉ !*\n\n✅ Bonne réponse !\n\n🏆 Score final : ${game.score}/${game.total}\n\n${game.score === game.total ? '💯 PARFAIT !' : game.score >= game.total / 2 ? '👏 Bien joué !' : '💪 Retente !'}`
                });
                activeGames.delete(gameKey);
            } else {
                const nextQ = game.questions[game.currentIndex];
                const optionsText = nextQ.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

                await sock.sendMessage(from, {
                    text: `✅ Correct !\n\n❓ Question ${game.currentIndex + 1}/${game.total}\n\n${nextQ.q}\n\n${optionsText}\n\n💡 Reply 1, 2 ou 3`
                });
            }
        } else if (answer >= 0 && answer < 3) {
            await sock.sendMessage(from, {
                text: `❌ Faux !\n\nRéponse : ${currentQ.options[currentQ.correct]}\n\nScore : ${game.score}/${game.currentIndex + 1}\n\n💡 Continue !`
            });

            game.currentIndex++;
            if (game.currentIndex >= game.total) {
                await sock.sendMessage(from, {
                    text: `🏁 *FIN !*\n\n🏆 Score final : ${game.score}/${game.total}`
                });
                activeGames.delete(gameKey);
            } else {
                const nextQ = game.questions[game.currentIndex];
                const optionsText = nextQ.options.map((opt, i) => `${i + 1}. ${opt}`).join('\n');

                setTimeout(async () => {
                    await sock.sendMessage(from, {
                        text: `❓ Question ${game.currentIndex + 1}/${game.total}\n\n${nextQ.q}\n\n${optionsText}\n\n💡 Reply 1, 2 ou 3`
                    });
                }, 2000);
            }
        }
    }
}
