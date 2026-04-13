import { prisma } from "../../lib/prisma.js";
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
function toNumber(value) {
    if (value === null || value === undefined) {
        return 0;
    }
    if (typeof value === "bigint") {
        return Number(value);
    }
    return value;
}
function normalizeStreet(value) {
    if (!value) {
        return "PREFLOP";
    }
    const upper = value.toUpperCase();
    if (upper === "PREFLOP") {
        return "PREFLOP";
    }
    if (upper === "FLOP") {
        return "FLOP";
    }
    if (upper === "TURN") {
        return "TURN";
    }
    if (upper === "RIVER") {
        return "RIVER";
    }
    return "SHOWDOWN";
}
function toPublicStreet(street) {
    switch (street) {
        case "PREFLOP":
            return "preflop";
        case "FLOP":
            return "flop";
        case "TURN":
            return "turn";
        case "RIVER":
            return "river";
        case "SHOWDOWN":
            return "showdown";
        default:
            return "preflop";
    }
}
function toPublicRoomStatus(status) {
    const normalized = status.toUpperCase();
    if (normalized === "ACTIVE") {
        return "active";
    }
    if (normalized === "FINISHED") {
        return "finished";
    }
    if (normalized === "CANCELLED") {
        return "cancelled";
    }
    return "waiting";
}
function normalizeRoomCode(roomCode) {
    return roomCode.trim().toUpperCase();
}
function getSeatedActivePlayers(players) {
    return players
        .filter((player) => !player.leftAt && player.seatIndex !== null)
        .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));
}
function getNextSeat(orderedPlayers, fromSeat, predicate) {
    if (orderedPlayers.length === 0) {
        return null;
    }
    const startIndex = orderedPlayers.findIndex((player) => player.seatIndex === fromSeat);
    const safeIndex = startIndex >= 0 ? startIndex : 0;
    for (let step = 1; step <= orderedPlayers.length; step += 1) {
        const cursor = (safeIndex + step) % orderedPlayers.length;
        const candidate = orderedPlayers[cursor];
        if (predicate(candidate)) {
            return candidate.seatIndex;
        }
    }
    return null;
}
function getActionablePlayers(players) {
    return players.filter((player) => !player.hasFolded && !player.isAllIn && toNumber(player.stack) > 0);
}
function getContendingPlayers(players) {
    return players.filter((player) => !player.hasFolded);
}
function getCurrentBet(players) {
    const contenders = getContendingPlayers(players);
    if (contenders.length === 0) {
        return 0;
    }
    return Math.max(...contenders.map((player) => toNumber(player.currentBet)));
}
function computeLegalActions(player, currentBet, isTurn) {
    if (!player || !isTurn || player.hasFolded || player.isAllIn || toNumber(player.stack) <= 0) {
        return [];
    }
    const toCall = Math.max(0, currentBet - toNumber(player.currentBet));
    if (toCall === 0) {
        return ["fold", "check", "bet", "all-in"];
    }
    return ["fold", "call", "raise", "all-in"];
}
function computeNextStreet(street) {
    if (street === "PREFLOP") {
        return "FLOP";
    }
    if (street === "FLOP") {
        return "TURN";
    }
    if (street === "TURN") {
        return "RIVER";
    }
    return "SHOWDOWN";
}
async function fetchRoomByCode(roomCode) {
    return (await prisma.gameRoom.findUnique({
        where: { roomCode: normalizeRoomCode(roomCode) },
        include: {
            roomPlayers: true,
            hands: {
                orderBy: {
                    handNumber: "desc"
                },
                take: 1,
                select: {
                    id: true,
                    handNumber: true,
                    street: true,
                    status: true
                }
            }
        }
    }));
}
function buildRoomState(room, currentUserId) {
    const activeSeat = room.activeSeat;
    const roomStatus = toPublicRoomStatus(room.status);
    const streetCode = normalizeStreet(room.currentStreet);
    const sortedPlayers = room.roomPlayers
        .filter((player) => !player.leftAt)
        .sort((a, b) => {
        const aSeat = a.seatIndex ?? 999;
        const bSeat = b.seatIndex ?? 999;
        if (aSeat !== bSeat) {
            return aSeat - bSeat;
        }
        return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
    const players = sortedPlayers.map((player) => {
        const stack = toNumber(player.stack);
        const currentBet = toNumber(player.currentBet);
        const status = player.hasFolded
            ? "folded"
            : player.isAllIn || stack <= 0
                ? "all-in"
                : player.seatIndex !== null && activeSeat !== null && player.seatIndex === activeSeat
                    ? "acting"
                    : "waiting";
        return {
            id: player.id,
            userId: player.userId,
            displayName: player.displayName,
            seatIndex: player.seatIndex,
            isHost: player.isHost,
            isReady: player.isReady,
            isConnected: player.isConnected,
            stack,
            currentBet,
            status,
            joinedAtIso: player.joinedAt.toISOString()
        };
    });
    const mePlayer = sortedPlayers.find((player) => player.userId === currentUserId) ?? null;
    const allReady = players.length > 0 && players.every((player) => player.isReady);
    const currentBet = getCurrentBet(sortedPlayers);
    const activePlayer = sortedPlayers.find((player) => player.seatIndex === activeSeat) ?? null;
    const isMyTurn = roomStatus === "active" &&
        streetCode !== "SHOWDOWN" &&
        !!mePlayer &&
        mePlayer.seatIndex !== null &&
        activeSeat !== null &&
        mePlayer.seatIndex === activeSeat;
    const toCall = mePlayer ? Math.max(0, currentBet - toNumber(mePlayer.currentBet)) : 0;
    return {
        room: {
            id: room.id,
            code: room.roomCode,
            status: roomStatus,
            hostUserId: room.hostUserId,
            maxPlayers: room.maxPlayers,
            createdAtIso: room.createdAt.toISOString(),
            startedAtIso: room.startedAt?.toISOString() ?? null
        },
        players,
        me: mePlayer
            ? {
                userId: mePlayer.userId,
                seatIndex: mePlayer.seatIndex,
                isHost: mePlayer.isHost,
                isReady: mePlayer.isReady
            }
            : null,
        canStart: !!mePlayer?.isHost && roomStatus === "waiting" && players.length >= 2 && allReady,
        game: roomStatus !== "active"
            ? null
            : {
                handId: room.hands[0]?.id ?? null,
                handNumber: room.currentHandNumber,
                street: toPublicStreet(streetCode),
                status: streetCode === "SHOWDOWN" ? "showdown" : "in-progress",
                potTotal: toNumber(room.potTotal),
                currentBet,
                activeSeat,
                activePlayerUserId: activePlayer?.userId ?? null,
                isMyTurn,
                legalActions: computeLegalActions(mePlayer, currentBet, isMyTurn),
                toCall,
                minBet: Math.max(1, toNumber(room.bigBlind)),
                minRaiseDelta: Math.max(1, toNumber(room.bigBlind))
            }
    };
}
function generateRoomCodeCandidate() {
    let code = "";
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
        const index = Math.floor(Math.random() * ROOM_CODE_ALPHABET.length);
        code += ROOM_CODE_ALPHABET[index];
    }
    return code;
}
async function generateUniqueRoomCode() {
    for (let attempts = 0; attempts < 10; attempts += 1) {
        const candidate = generateRoomCodeCandidate();
        const exists = await prisma.gameRoom.findUnique({
            where: { roomCode: candidate },
            select: { id: true }
        });
        if (!exists) {
            return candidate;
        }
    }
    throw new Error("ROOM_CODE_GENERATION_FAILED");
}
async function resolveDisplayName(userId, preferredName) {
    if (preferredName?.trim()) {
        return preferredName.trim();
    }
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            email: true,
            profile: {
                select: {
                    username: true
                }
            }
        }
    });
    if (user?.profile?.username) {
        return user.profile.username;
    }
    if (user?.email) {
        return user.email.split("@")[0];
    }
    return "Player";
}
function mapActionTypeToDb(actionType) {
    if (actionType === "all-in") {
        return "ALL_IN";
    }
    return actionType.toUpperCase();
}
async function finalizeRoomAndArchive(input) {
    const { tx, room, handId, finalPotTotal } = input;
    const finishedAt = new Date();
    const roomUpdate = await tx.gameRoom.updateMany({
        where: {
            id: room.id,
            status: "ACTIVE"
        },
        data: {
            status: "FINISHED",
            currentStreet: "SHOWDOWN",
            activeSeat: null,
            potTotal: BigInt(finalPotTotal),
            finishedAt
        }
    });
    if (roomUpdate.count === 0) {
        return;
    }
    await tx.hand.update({
        where: { id: handId },
        data: {
            status: "SHOWDOWN",
            street: "SHOWDOWN",
            activeSeat: null,
            potTotal: BigInt(finalPotTotal),
            settledAt: finishedAt
        }
    });
    const totalHands = Math.max(1, room.currentHandNumber);
    const session = await tx.gameSession.upsert({
        where: {
            roomId: room.id
        },
        create: {
            roomId: room.id,
            hostUserId: room.hostUserId,
            totalHands,
            startedAt: room.startedAt ?? finishedAt,
            finishedAt
        },
        update: {
            totalHands,
            finishedAt
        }
    });
    const participants = (await tx.roomPlayer.findMany({
        where: {
            roomId: room.id
        }
    }));
    const settledPlayers = participants
        .filter((player) => !player.leftAt && player.seatIndex !== null)
        .sort((a, b) => (a.seatIndex ?? 999) - (b.seatIndex ?? 999));
    const contenders = settledPlayers.filter((player) => !player.hasFolded);
    const payoutTargets = contenders.length > 0 ? contenders : settledPlayers;
    if (finalPotTotal > 0 && payoutTargets.length > 0) {
        const payoutByPlayerId = new Map();
        if (payoutTargets.length === 1) {
            payoutByPlayerId.set(payoutTargets[0].id, finalPotTotal);
        }
        else {
            const eachShare = Math.floor(finalPotTotal / payoutTargets.length);
            const remainder = finalPotTotal % payoutTargets.length;
            payoutTargets.forEach((player, index) => {
                payoutByPlayerId.set(player.id, eachShare + (index === 0 ? remainder : 0));
            });
        }
        for (const player of payoutTargets) {
            const amountWon = payoutByPlayerId.get(player.id) ?? 0;
            if (amountWon <= 0) {
                continue;
            }
            await tx.roomPlayer.update({
                where: { id: player.id },
                data: {
                    stack: {
                        increment: BigInt(amountWon)
                    }
                }
            });
            await tx.handResult.create({
                data: {
                    handId,
                    roomId: room.id,
                    userId: player.userId,
                    resultType: payoutTargets.length === 1 ? "WIN" : "SPLIT",
                    amountWon: BigInt(amountWon),
                    netChange: BigInt(amountWon)
                }
            });
        }
    }
    const participantsAfterSettlement = (await tx.roomPlayer.findMany({
        where: {
            roomId: room.id
        }
    }));
    const startStack = toNumber(room.startingStack);
    for (const participant of participantsAfterSettlement) {
        const endStack = toNumber(participant.stack);
        const profitLoss = endStack - startStack;
        const distinctHands = await tx.handAction.findMany({
            where: {
                roomId: room.id,
                userId: participant.userId
            },
            select: {
                handId: true
            },
            distinct: ["handId"]
        });
        const handsPlayed = participant.seatIndex === null ? 0 : Math.max(totalHands > 0 ? 1 : 0, distinctHands.length);
        await tx.playerSessionStat.upsert({
            where: {
                gameSessionId_userId: {
                    gameSessionId: session.id,
                    userId: participant.userId
                }
            },
            create: {
                gameSessionId: session.id,
                roomId: room.id,
                userId: participant.userId,
                startStack: BigInt(startStack),
                endStack: BigInt(endStack),
                profitLoss: BigInt(profitLoss),
                handsPlayed
            },
            update: {
                startStack: BigInt(startStack),
                endStack: BigInt(endStack),
                profitLoss: BigInt(profitLoss),
                handsPlayed
            }
        });
        await tx.profile.updateMany({
            where: { userId: participant.userId },
            data: {
                totalSessions: {
                    increment: 1
                },
                totalHands: {
                    increment: handsPlayed
                },
                totalProfit: {
                    increment: profitLoss > 0 ? BigInt(profitLoss) : BigInt(0)
                },
                totalLoss: {
                    increment: profitLoss < 0 ? BigInt(Math.abs(profitLoss)) : BigInt(0)
                }
            }
        });
    }
}
export async function createRoom(input) {
    const roomCode = await generateUniqueRoomCode();
    const maxPlayers = input.maxPlayers ?? 6;
    const startingStack = BigInt(input.startingStack ?? 10000);
    const smallBlind = BigInt(input.smallBlind ?? 100);
    const bigBlind = BigInt(input.bigBlind ?? 200);
    const displayName = await resolveDisplayName(input.hostUserId);
    await prisma.gameRoom.create({
        data: {
            roomCode,
            hostUserId: input.hostUserId,
            status: "WAITING",
            maxPlayers,
            startingStack,
            smallBlind,
            bigBlind,
            roomPlayers: {
                create: {
                    userId: input.hostUserId,
                    displayName,
                    seatIndex: 0,
                    stack: startingStack,
                    isHost: true,
                    isReady: true,
                    isConnected: true
                }
            }
        }
    });
    const room = await fetchRoomByCode(roomCode);
    if (!room) {
        throw new Error("ROOM_CREATE_FAILED");
    }
    return buildRoomState(room, input.hostUserId);
}
export async function joinRoomByCode(input) {
    const roomCode = normalizeRoomCode(input.roomCode);
    const room = await fetchRoomByCode(roomCode);
    if (!room) {
        throw new Error("ROOM_NOT_FOUND");
    }
    const activePlayers = room.roomPlayers.filter((player) => !player.leftAt);
    const member = activePlayers.find((player) => player.userId === input.userId);
    if (!member) {
        if (room.status !== "WAITING" && !room.allowJoinAfterStart) {
            throw new Error("ROOM_NOT_JOINABLE");
        }
        if (activePlayers.length >= room.maxPlayers) {
            throw new Error("ROOM_FULL");
        }
        const usedSeats = new Set(activePlayers.map((player) => player.seatIndex).filter((seat) => seat !== null));
        let nextSeat = null;
        for (let i = 0; i < room.maxPlayers; i += 1) {
            if (!usedSeats.has(i)) {
                nextSeat = i;
                break;
            }
        }
        if (nextSeat === null) {
            throw new Error("ROOM_FULL");
        }
        const displayName = await resolveDisplayName(input.userId, input.displayName);
        await prisma.roomPlayer.create({
            data: {
                roomId: room.id,
                userId: input.userId,
                displayName,
                seatIndex: nextSeat,
                stack: room.startingStack,
                isHost: false,
                isReady: false,
                isConnected: true
            }
        });
    }
    else {
        await prisma.roomPlayer.update({
            where: { id: member.id },
            data: {
                isConnected: true,
                leftAt: null,
                seatIndex: member.seatIndex ?? 0
            }
        });
    }
    const next = await fetchRoomByCode(roomCode);
    if (!next) {
        throw new Error("ROOM_NOT_FOUND");
    }
    return buildRoomState(next, input.userId);
}
export async function getRoomStateByCode(roomCode, currentUserId) {
    const room = await fetchRoomByCode(roomCode);
    if (!room) {
        return null;
    }
    return buildRoomState(room, currentUserId);
}
export async function setPlayerReadyByRoomCode(input) {
    const room = await fetchRoomByCode(input.roomCode);
    if (!room) {
        throw new Error("ROOM_NOT_FOUND");
    }
    const member = room.roomPlayers.find((player) => player.userId === input.userId && !player.leftAt);
    if (!member) {
        throw new Error("NOT_A_MEMBER");
    }
    if (room.status !== "WAITING") {
        throw new Error("ROOM_NOT_WAITING");
    }
    await prisma.roomPlayer.update({
        where: { id: member.id },
        data: { isReady: input.isReady }
    });
    const next = await fetchRoomByCode(input.roomCode);
    if (!next) {
        throw new Error("ROOM_NOT_FOUND");
    }
    return buildRoomState(next, input.userId);
}
async function startFirstHand(roomCode, hostUserId) {
    await prisma.$transaction(async (tx) => {
        const room = (await tx.gameRoom.findUnique({
            where: { roomCode },
            include: {
                roomPlayers: true
            }
        }));
        if (!room) {
            throw new Error("ROOM_NOT_FOUND");
        }
        if (room.hostUserId !== hostUserId) {
            throw new Error("HOST_ONLY");
        }
        if (room.status !== "WAITING") {
            throw new Error("ROOM_ALREADY_STARTED");
        }
        const activePlayers = getSeatedActivePlayers(room.roomPlayers);
        const readyPlayers = activePlayers.filter((player) => player.isReady);
        if (readyPlayers.length < 2 || readyPlayers.length !== activePlayers.length) {
            throw new Error("ROOM_NOT_READY");
        }
        const dealerSeat = room.dealerSeat !== null && activePlayers.some((player) => player.seatIndex === room.dealerSeat)
            ? room.dealerSeat
            : activePlayers[0].seatIndex;
        const sbSeat = getNextSeat(activePlayers, dealerSeat ?? 0, () => true);
        const bbSeat = getNextSeat(activePlayers, sbSeat ?? dealerSeat ?? 0, () => true);
        await Promise.all(activePlayers.map((player) => tx.roomPlayer.update({
            where: { id: player.id },
            data: {
                currentBet: 0,
                hasFolded: false,
                isAllIn: toNumber(player.stack) <= 0
            }
        })));
        const afterReset = (await tx.roomPlayer.findMany({
            where: {
                roomId: room.id,
                leftAt: null
            }
        }));
        let potTotal = 0;
        let actionOrder = 1;
        const blindActions = [];
        async function postBlind(seatIndex, amount, actionType) {
            if (seatIndex === null || amount <= 0) {
                return;
            }
            const player = afterReset.find((item) => item.seatIndex === seatIndex);
            if (!player) {
                return;
            }
            const stack = toNumber(player.stack);
            const contribution = Math.min(stack, amount);
            if (contribution <= 0) {
                return;
            }
            const stackAfter = stack - contribution;
            await tx.roomPlayer.update({
                where: { id: player.id },
                data: {
                    stack: BigInt(stackAfter),
                    currentBet: BigInt(contribution),
                    isAllIn: stackAfter <= 0
                }
            });
            player.stack = BigInt(stackAfter);
            player.currentBet = BigInt(contribution);
            player.isAllIn = stackAfter <= 0;
            potTotal += contribution;
            blindActions.push({
                userId: player.userId,
                seatIndex,
                actionType,
                amount: contribution
            });
        }
        await postBlind(sbSeat, toNumber(room.smallBlind), "POST_SB");
        await postBlind(bbSeat, toNumber(room.bigBlind), "POST_BB");
        const withBlinds = (await tx.roomPlayer.findMany({
            where: {
                roomId: room.id,
                leftAt: null
            }
        }));
        const actionable = getActionablePlayers(getSeatedActivePlayers(withBlinds));
        const firstActiveSeat = bbSeat === null
            ? actionable[0]?.seatIndex ?? null
            : getNextSeat(getSeatedActivePlayers(withBlinds), bbSeat, (player) => actionable.some((item) => item.id === player.id));
        const handNumber = room.currentHandNumber + 1;
        const hand = await tx.hand.create({
            data: {
                roomId: room.id,
                handNumber,
                status: "ACTIVE",
                street: "PREFLOP",
                dealerSeat: dealerSeat ?? 0,
                sbSeat: sbSeat ?? dealerSeat ?? 0,
                bbSeat: bbSeat ?? sbSeat ?? dealerSeat ?? 0,
                activeSeat: firstActiveSeat,
                potTotal: BigInt(potTotal),
                sidePotTotal: 0
            }
        });
        for (const action of blindActions) {
            await tx.handAction.create({
                data: {
                    handId: hand.id,
                    roomId: room.id,
                    userId: action.userId,
                    seatIndex: action.seatIndex,
                    street: "PREFLOP",
                    actionType: action.actionType,
                    amount: BigInt(action.amount),
                    actionOrder,
                    createdAt: new Date()
                }
            });
            actionOrder += 1;
        }
        await tx.gameRoom.update({
            where: { id: room.id },
            data: {
                status: "ACTIVE",
                startedAt: room.startedAt ?? new Date(),
                currentHandNumber: handNumber,
                currentStreet: "PREFLOP",
                dealerSeat: dealerSeat ?? 0,
                activeSeat: firstActiveSeat,
                potTotal: BigInt(potTotal),
                sidePotTotal: 0
            }
        });
    });
}
export async function startRoomByHost(input) {
    const roomCode = normalizeRoomCode(input.roomCode);
    await startFirstHand(roomCode, input.hostUserId);
    const next = await fetchRoomByCode(roomCode);
    if (!next) {
        throw new Error("ROOM_NOT_FOUND");
    }
    return buildRoomState(next, input.hostUserId);
}
export async function applyPlayerActionByRoomCode(input) {
    const roomCode = normalizeRoomCode(input.roomCode);
    await prisma.$transaction(async (tx) => {
        const room = (await tx.gameRoom.findUnique({
            where: { roomCode },
            include: {
                roomPlayers: true,
                hands: {
                    orderBy: {
                        handNumber: "desc"
                    },
                    take: 1,
                    select: {
                        id: true,
                        handNumber: true,
                        street: true,
                        status: true
                    }
                }
            }
        }));
        if (!room) {
            throw new Error("ROOM_NOT_FOUND");
        }
        if (room.status !== "ACTIVE") {
            throw new Error("ROOM_NOT_ACTIVE");
        }
        const street = normalizeStreet(room.currentStreet);
        if (street === "SHOWDOWN") {
            throw new Error("HAND_LOCKED");
        }
        const hand = room.hands[0];
        if (!hand) {
            throw new Error("HAND_NOT_FOUND");
        }
        const players = getSeatedActivePlayers(room.roomPlayers);
        const actor = players.find((player) => player.userId === input.userId);
        if (!actor) {
            throw new Error("NOT_A_MEMBER");
        }
        if (actor.seatIndex === null || room.activeSeat === null || actor.seatIndex !== room.activeSeat) {
            throw new Error("NOT_YOUR_TURN");
        }
        const currentBet = getCurrentBet(players);
        const legalActions = computeLegalActions(actor, currentBet, true);
        if (!legalActions.includes(input.actionType)) {
            throw new Error("ILLEGAL_ACTION");
        }
        const actorStack = toNumber(actor.stack);
        const actorCurrentBet = toNumber(actor.currentBet);
        const toCall = Math.max(0, currentBet - actorCurrentBet);
        const bigBlind = Math.max(1, toNumber(room.bigBlind));
        let contribution = 0;
        let nextStack = actorStack;
        let nextCurrentBet = actorCurrentBet;
        let hasFolded = actor.hasFolded;
        switch (input.actionType) {
            case "fold": {
                hasFolded = true;
                break;
            }
            case "check": {
                if (toCall !== 0) {
                    throw new Error("ILLEGAL_ACTION");
                }
                break;
            }
            case "call": {
                if (toCall <= 0) {
                    throw new Error("ILLEGAL_ACTION");
                }
                contribution = Math.min(actorStack, toCall);
                nextStack = actorStack - contribution;
                nextCurrentBet = actorCurrentBet + contribution;
                break;
            }
            case "bet": {
                if (toCall !== 0) {
                    throw new Error("ILLEGAL_ACTION");
                }
                contribution = Math.min(actorStack, bigBlind);
                nextStack = actorStack - contribution;
                nextCurrentBet = actorCurrentBet + contribution;
                break;
            }
            case "raise": {
                if (toCall <= 0) {
                    throw new Error("ILLEGAL_ACTION");
                }
                contribution = Math.min(actorStack, toCall + bigBlind);
                nextStack = actorStack - contribution;
                nextCurrentBet = actorCurrentBet + contribution;
                break;
            }
            case "all-in": {
                contribution = actorStack;
                nextStack = 0;
                nextCurrentBet = actorCurrentBet + contribution;
                break;
            }
            default:
                throw new Error("ILLEGAL_ACTION");
        }
        const finalPotTotal = toNumber(room.potTotal) + contribution;
        await tx.roomPlayer.update({
            where: { id: actor.id },
            data: {
                stack: BigInt(nextStack),
                currentBet: BigInt(nextCurrentBet),
                hasFolded,
                isAllIn: nextStack <= 0
            }
        });
        if (contribution > 0) {
            await tx.gameRoom.update({
                where: { id: room.id },
                data: {
                    potTotal: BigInt(finalPotTotal)
                }
            });
        }
        const actionCount = await tx.handAction.count({
            where: {
                handId: hand.id
            }
        });
        await tx.handAction.create({
            data: {
                handId: hand.id,
                roomId: room.id,
                userId: actor.userId,
                seatIndex: actor.seatIndex,
                street,
                actionType: mapActionTypeToDb(input.actionType),
                amount: BigInt(contribution),
                actionOrder: actionCount + 1
            }
        });
        const nextPlayers = (await tx.roomPlayer.findMany({
            where: {
                roomId: room.id,
                leftAt: null
            }
        }));
        const seatedNextPlayers = getSeatedActivePlayers(nextPlayers);
        const contenders = getContendingPlayers(seatedNextPlayers);
        const actionable = getActionablePlayers(seatedNextPlayers);
        if (contenders.length <= 1 || actionable.length === 0) {
            await finalizeRoomAndArchive({
                tx,
                room,
                handId: hand.id,
                finalPotTotal
            });
            return;
        }
        const nextCurrentBetMax = getCurrentBet(seatedNextPlayers);
        let roundComplete = false;
        let nextActiveSeat = null;
        if (nextCurrentBetMax === 0) {
            const streetActions = await tx.handAction.findMany({
                where: {
                    handId: hand.id,
                    street
                },
                select: {
                    seatIndex: true
                }
            });
            const actedSeats = new Set(streetActions.map((action) => action.seatIndex));
            roundComplete = actionable.every((player) => player.seatIndex !== null ? actedSeats.has(player.seatIndex) : false);
            if (!roundComplete) {
                nextActiveSeat = getNextSeat(seatedNextPlayers, actor.seatIndex, (player) => actionable.some((candidate) => candidate.id === player.id));
            }
        }
        else {
            const needResponse = actionable.filter((player) => toNumber(player.currentBet) < nextCurrentBetMax);
            roundComplete = needResponse.length === 0;
            if (!roundComplete) {
                nextActiveSeat = getNextSeat(seatedNextPlayers, actor.seatIndex, (player) => needResponse.some((candidate) => candidate.id === player.id));
            }
        }
        if (!roundComplete && nextActiveSeat !== null) {
            await tx.gameRoom.update({
                where: { id: room.id },
                data: {
                    activeSeat: nextActiveSeat,
                    currentStreet: street
                }
            });
            await tx.hand.update({
                where: { id: hand.id },
                data: {
                    activeSeat: nextActiveSeat,
                    street,
                    potTotal: BigInt(finalPotTotal)
                }
            });
            return;
        }
        const nextStreet = computeNextStreet(street);
        if (nextStreet === "SHOWDOWN") {
            await finalizeRoomAndArchive({
                tx,
                room,
                handId: hand.id,
                finalPotTotal
            });
            return;
        }
        await tx.roomPlayer.updateMany({
            where: {
                roomId: room.id,
                leftAt: null
            },
            data: {
                currentBet: 0
            }
        });
        const afterStreetReset = (await tx.roomPlayer.findMany({
            where: {
                roomId: room.id,
                leftAt: null
            }
        }));
        const seatedResetPlayers = getSeatedActivePlayers(afterStreetReset);
        const actionableAfterReset = getActionablePlayers(seatedResetPlayers);
        const dealerSeat = room.dealerSeat ?? seatedResetPlayers[0]?.seatIndex ?? null;
        const streetFirstSeat = dealerSeat === null
            ? actionableAfterReset[0]?.seatIndex ?? null
            : getNextSeat(seatedResetPlayers, dealerSeat, (player) => actionableAfterReset.some((candidate) => candidate.id === player.id));
        if (streetFirstSeat === null) {
            await finalizeRoomAndArchive({
                tx,
                room,
                handId: hand.id,
                finalPotTotal
            });
            return;
        }
        await tx.gameRoom.update({
            where: { id: room.id },
            data: {
                currentStreet: nextStreet,
                activeSeat: streetFirstSeat
            }
        });
        await tx.hand.update({
            where: { id: hand.id },
            data: {
                street: nextStreet,
                activeSeat: streetFirstSeat,
                potTotal: BigInt(finalPotTotal)
            }
        });
    });
    const next = await fetchRoomByCode(roomCode);
    if (!next) {
        throw new Error("ROOM_NOT_FOUND");
    }
    return buildRoomState(next, input.userId);
}
export async function setPlayerConnectionByRoomCode(input) {
    const room = await fetchRoomByCode(input.roomCode);
    if (!room) {
        return;
    }
    const member = room.roomPlayers.find((player) => player.userId === input.userId && !player.leftAt);
    if (!member) {
        return;
    }
    await prisma.roomPlayer.update({
        where: { id: member.id },
        data: {
            isConnected: input.isConnected
        }
    });
}
