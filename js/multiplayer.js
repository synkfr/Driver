// ==========================================
// MULTIPLAYER — LAN networking client
// ==========================================
// Connects to the WebSocket server, sends local car state,
// receives other players' states, and renders ghost cars.
import * as THREE from 'three';
import { velocity, heading, steeringAngle } from './physics.js';

let ws = null;
let myId = null;
let myColor = 0x00ffcc;
const remotePlayers = {}; // id -> { mesh, nameSprite, state, lastUpdate }
let scene = null;
let connected = false;
let sendInterval = null;
let connectAttempts = 0;
const MAX_RECONNECT = 5;

// ====== CONNECTION STATUS UI ======
const showStatus = (msg, color) => {
    let el = document.getElementById('mp-status');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mp-status';
        el.style.cssText = `position:fixed;top:20px;left:50%;transform:translateX(-50%);
      padding:8px 20px;border-radius:20px;font-size:13px;font-family:sans-serif;
      z-index:200;pointer-events:none;transition:opacity 0.5s;color:white;
      background:rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.15);`;
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = color || 'rgba(255,255,255,0.15)';
    el.style.opacity = '1';

    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.opacity = '0'; }, 4000);
};

// ====== PLAYER COUNT UI ======
const updatePlayerCount = () => {
    let el = document.getElementById('mp-players');
    if (!el) {
        el = document.createElement('div');
        el.id = 'mp-players';
        el.style.cssText = `position:fixed;top:60px;right:30px;
      padding:6px 14px;border-radius:12px;font-size:12px;font-family:sans-serif;
      z-index:200;pointer-events:none;color:#00ffcc;
      background:rgba(0,0,0,0.6);border:1px solid rgba(0,255,204,0.2);`;
        document.body.appendChild(el);
    }
    const count = Object.keys(remotePlayers).length + 1;
    el.textContent = `🏎️ ${count} player${count !== 1 ? 's' : ''} online`;
    el.style.display = connected ? 'block' : 'none';
};

// ====== BUILD GHOST CAR ======
const roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
};

const createNameTag = (text, color) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, 8, 8, 240, 48, 16);
    ctx.fill();

    const hexColor = `#${('000000' + color.toString(16)).slice(-6)}`;
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 2;
    roundRect(ctx, 8, 8, 240, 48, 16);
    ctx.stroke();

    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
        map: texture, transparent: true,
        depthWrite: false, sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4, 1, 1);
    return sprite;
};

const createGhostCar = (color, name) => {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
        color, metalness: 0.6, roughness: 0.3,
        transparent: true, opacity: 0.85,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 4.6), bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.35, 1.8),
        new THREE.MeshStandardMaterial({
            color: 0x112244, transparent: true, opacity: 0.35,
            metalness: 0.8, roughness: 0.1,
        })
    );
    cabin.position.set(0, 0.95, -0.1);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.6), bodyMat);
    roof.position.set(0, 1.15, -0.1);
    group.add(roof);

    const tlMat = new THREE.MeshBasicMaterial({ color: 0xcc0000 });
    for (const x of [-0.6, 0.6]) {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.04), tlMat);
        tl.position.set(x, 0.7, -2.32);
        group.add(tl);
    }

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const x of [-0.6, 0.6]) {
        const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, 0.04), hlMat);
        hl.position.set(x, 0.7, 2.32);
        group.add(hl);
    }

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const [wx, wz] of [[-1.05, 1.4], [1.05, 1.4], [-1.05, -1.5], [1.05, -1.5]]) {
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), wheelMat
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx, 0.35, wz);
        group.add(wheel);
    }

    const nameSprite = createNameTag(name, color);
    nameSprite.position.set(0, 2.2, 0);
    group.add(nameSprite);

    return { mesh: group, nameSprite };
};

// ====== REMOTE PLAYER MANAGEMENT ======
const addRemotePlayer = (id, color, name, state) => {
    if (remotePlayers[id]) return;

    const ghost = createGhostCar(color, name || 'Player');
    scene.add(ghost.mesh);

    remotePlayers[id] = {
        mesh: ghost.mesh,
        nameSprite: ghost.nameSprite,
        _name: name || 'Player',
        state: state || { x: 0, z: 0, heading: 0, speed: 0 },
        targetState: state || { x: 0, z: 0, heading: 0, speed: 0 },
        lastUpdate: performance.now(),
    };

    if (state) {
        ghost.mesh.position.set(state.x || 0, 0, state.z || 0);
        ghost.mesh.rotation.y = state.heading || 0;
    }
};

const removeRemotePlayer = (id) => {
    const player = remotePlayers[id];
    if (player) {
        scene.remove(player.mesh);
        player.mesh.traverse((child) => {
            if (child.isMesh) {
                child.material?.dispose();
                child.geometry?.dispose();
            }
            if (child.isSprite && child.material) {
                child.material.map?.dispose();
                child.material.dispose();
            }
        });
        delete remotePlayers[id];
    }
};

// ====== MESSAGE HANDLER ======
const handleMessage = (msg) => {
    switch (msg.type) {
        case 'welcome':
            myId = msg.id;
            myColor = msg.color;
            showStatus(`You are ${msg.name} — share your LAN URL!`, '#00ffcc');
            break;

        case 'join':
            if (msg.id !== myId) {
                addRemotePlayer(msg.id, msg.color, msg.name, msg.state);
                showStatus(`${msg.name} joined the race!`, '#00ffcc');
                updatePlayerCount();
            }
            break;

        case 'leave':
            if (remotePlayers[msg.id]) {
                showStatus(`${remotePlayers[msg.id]._name} left`, '#ff8800');
                removeRemotePlayer(msg.id);
                updatePlayerCount();
            }
            break;

        case 'update':
            if (msg.states) {
                for (const ps of msg.states) {
                    if (ps.id !== myId && ps.state && remotePlayers[ps.id]) {
                        remotePlayers[ps.id].targetState = ps.state;
                        remotePlayers[ps.id].lastUpdate = performance.now();
                    }
                }
            }
            break;
    }
};

// ====== SEND LOCAL STATE ======
let mpCar = null;

const sendState = () => {
    if (!ws || ws.readyState !== 1 || !velocity) return;
    if (!mpCar) return;

    ws.send(JSON.stringify({
        type: 'state',
        state: {
            x: Math.round(mpCar.position.x * 100) / 100,
            z: Math.round(mpCar.position.z * 100) / 100,
            heading: Math.round(heading * 1000) / 1000,
            speed: Math.round(velocity.length() * 10) / 10,
            steer: Math.round((steeringAngle || 0) * 1000) / 1000,
            drifting: false,
        },
    }));
};

// ====== CONNECTION ======
const connect = () => {
    if (connectAttempts >= MAX_RECONNECT) {
        showStatus('Multiplayer: could not connect', '#ff4444');
        return;
    }

    const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const host = location.host || 'localhost:3000';
    const url = protocol + host;

    showStatus('Connecting to server...', '#ffaa00');

    try {
        ws = new WebSocket(url);
    } catch {
        showStatus('Multiplayer unavailable (run node server.js)', '#ff4444');
        return;
    }

    ws.onopen = () => {
        connected = true;
        connectAttempts = 0;
        showStatus('Connected! Waiting for other players...', '#00ffcc');
        updatePlayerCount();
        sendInterval = setInterval(sendState, 50);
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            handleMessage(msg);
        } catch {
            // ignore
        }
    };

    ws.onclose = () => {
        connected = false;
        clearInterval(sendInterval);

        for (const id of Object.keys(remotePlayers)) {
            removeRemotePlayer(id);
        }
        updatePlayerCount();

        connectAttempts++;
        if (connectAttempts < MAX_RECONNECT) {
            showStatus('Disconnected. Reconnecting...', '#ffaa00');
            setTimeout(connect, 2000);
        } else {
            showStatus('Server connection lost', '#ff4444');
        }
    };

    ws.onerror = () => { };
};

// ====== PUBLIC API ======
export const initMultiplayer = (gameScene) => {
    scene = gameScene;
    connect();
};

export const updateMultiplayer = (localCar) => {
    mpCar = localCar;

    if (!connected) return;

    const now = performance.now();
    const lerpFactor = 0.15;

    for (const id of Object.keys(remotePlayers)) {
        const rp = remotePlayers[id];
        if (!rp?.targetState) continue;

        const ts = rp.targetState;
        const mesh = rp.mesh;

        mesh.position.x += (ts.x - mesh.position.x) * lerpFactor;
        mesh.position.z += (ts.z - mesh.position.z) * lerpFactor;

        const targetHeading = ts.heading || 0;
        let diff = targetHeading - mesh.rotation.y;

        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        mesh.rotation.y += diff * lerpFactor;

        if (now - rp.lastUpdate > 10000) {
            removeRemotePlayer(id);
            updatePlayerCount();
        }
    }
};

export const isMultiplayerConnected = () => connected;
export const getRemotePlayerCount = () => Object.keys(remotePlayers).length;
