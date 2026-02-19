import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const TICK_RATE = 20;

const MIME_TYPES = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

const httpServer = http.createServer((req, res) => {
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end('Forbidden'); return; }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            res.end(err.code === 'ENOENT' ? `Not Found: ${req.url}` : 'Server Error');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

const wss = new WebSocketServer({ server: httpServer });
const players = new Map();
let nextId = 1;

const CAR_COLORS = [
    0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f, 0xe76f51,
    0x6a4c93, 0x1982c4, 0xffca3a, 0xff595e, 0x8ac926,
];

const getPlayerColor = () => CAR_COLORS[nextId % CAR_COLORS.length];

wss.on('connection', (ws) => {
    const playerId = String(nextId++);
    const playerColor = getPlayerColor();
    const playerName = `Player ${playerId}`;

    players.set(playerId, {
        ws, color: playerColor, name: playerName,
        state: { x: 0, z: 0, heading: 0, speed: 0, steer: 0, drifting: false },
    });

    ws.send(JSON.stringify({ type: 'welcome', id: playerId, color: playerColor, name: playerName }));

    const joinMsg = JSON.stringify({ type: 'join', id: playerId, color: playerColor, name: playerName });
    players.forEach((data, id) => { if (id !== playerId && data.ws.readyState === 1) data.ws.send(joinMsg); });

    players.forEach((data, id) => {
        if (id !== playerId) {
            ws.send(JSON.stringify({ type: 'join', id, color: data.color, name: data.name, state: data.state }));
        }
    });

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw);
            if (msg.type === 'state') {
                const player = players.get(playerId);
                if (player) player.state = msg.state;
            } else if (msg.type === 'setName') {
                const player = players.get(playerId);
                if (player && msg.name) player.name = msg.name.substring(0, 16);
            }
        } catch { }
    });

    ws.on('close', () => {
        players.delete(playerId);
        const leaveMsg = JSON.stringify({ type: 'leave', id: playerId });
        players.forEach((data) => { if (data.ws.readyState === 1) data.ws.send(leaveMsg); });
    });
});

setInterval(() => {
    if (players.size < 2) return;
    const states = [];
    players.forEach((data, id) => { states.push({ id, state: data.state }); });
    const msg = JSON.stringify({ type: 'update', states });
    players.forEach((data) => { if (data.ws.readyState === 1) data.ws.send(msg); });
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => {
    console.log(`\n  🏎️  Neon Drive LAN Server`);
    console.log(`  Local:  http://localhost:${PORT}`);
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`  LAN:    http://${iface.address}:${PORT}`);
            }
        }
    }
    console.log('');
});
