// ==========================================
// NEON DRIVE — LAN Multiplayer Server
// ==========================================
// Run: node server.js
// Then open http://localhost:3000 in multiple browser tabs/machines
// Players on the same LAN can see and race each other.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const TICK_RATE = 20; // broadcast rate (Hz)

// ====== STATIC FILE SERVER ======
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.gltf': 'model/gltf+json',
    '.glb': 'model/gltf-binary',
    '.bin': 'application/octet-stream',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

    // Security: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end(`Not Found: ${req.url}`);
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

// ====== WEBSOCKET SERVER ======
const wss = new WebSocketServer({ server: httpServer });

const players = new Map(); // id -> { ws, state, color, name }
let nextId = 1;

// Random car colors for each player
const CAR_COLORS = [
    0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe76f51,
    0x6a4c93, 0x1982c4, 0xffca3a, 0xff595e, 0x8ac926,
];

const getPlayerColor = () => CAR_COLORS[nextId % CAR_COLORS.length];

const broadcastPlayerList = () => {
    const playerList = [];
    players.forEach((data, id) => {
        playerList.push({ id, color: data.color, name: data.name, state: data.state });
    });

    const msg = JSON.stringify({ type: 'players', players: playerList });
    players.forEach((data) => {
        if (data.ws.readyState === 1) data.ws.send(msg);
    });
};

wss.on('connection', (ws) => {
    const playerId = String(nextId++);
    const playerColor = getPlayerColor();
    const playerName = `Player ${playerId}`;

    players.set(playerId, {
        ws,
        color: playerColor,
        name: playerName,
        state: { x: 0, z: 0, heading: 0, speed: 0, steer: 0, drifting: false },
    });

    // Send the player their own ID and color
    ws.send(JSON.stringify({
        type: 'welcome',
        id: playerId,
        color: playerColor,
        name: playerName,
    }));

    console.log(`[+] ${playerName} connected (id: ${playerId}, color: #${playerColor.toString(16)})`);

    // Notify everyone about the new player
    const joinMsg = JSON.stringify({
        type: 'join',
        id: playerId,
        color: playerColor,
        name: playerName,
    });
    players.forEach((data, id) => {
        if (id !== playerId && data.ws.readyState === 1) data.ws.send(joinMsg);
    });

    // Send existing players to the newcomer
    players.forEach((data, id) => {
        if (id !== playerId) {
            ws.send(JSON.stringify({
                type: 'join',
                id,
                color: data.color,
                name: data.name,
                state: data.state,
            }));
        }
    });

    // Handle messages from this player
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'state') {
                const player = players.get(playerId);
                if (player) player.state = msg.state;
            } else if (msg.type === 'setName') {
                const player = players.get(playerId);
                if (player && msg.name) {
                    player.name = msg.name.substring(0, 16);
                    console.log(`[~] Player ${playerId} renamed to: ${player.name}`);
                }
            }
        } catch {
            // ignore bad messages
        }
    });

    // Handle disconnect
    ws.on('close', () => {
        const player = players.get(playerId);
        const name = player ? player.name : playerId;
        players.delete(playerId);
        console.log(`[-] ${name} disconnected`);

        const leaveMsg = JSON.stringify({ type: 'leave', id: playerId });
        players.forEach((data) => {
            if (data.ws.readyState === 1) data.ws.send(leaveMsg);
        });
    });
});

// ====== PERIODIC STATE BROADCAST ======
setInterval(() => {
    if (players.size < 2) return;

    const states = [];
    players.forEach((data, id) => {
        states.push({ id, state: data.state });
    });

    const msg = JSON.stringify({ type: 'update', states });
    players.forEach((data) => {
        if (data.ws.readyState === 1) data.ws.send(msg);
    });
}, 1000 / TICK_RATE);

// ====== START SERVER ======
httpServer.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║       🏎️  NEON DRIVE — LAN SERVER  🏎️     ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  Local:   http://localhost:${PORT}           ║`);

    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const padded = `http://${iface.address}:${PORT}`;
                console.log(`║  LAN:     ${padded.padEnd(29)}║`);
            }
        }
    }

    console.log('╠══════════════════════════════════════════╣');
    console.log('║  Share the LAN URL with other players!   ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});
