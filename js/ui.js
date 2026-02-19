// ==========================================
// UI — HUD updates, premium minimap, score display
// ==========================================
import { blocksPerSide, pitch, blockSize } from './environment.js';
import { keys } from './input.js';

export const updateScoreDisplay = (score, orbsCollected, combo) => {
    document.getElementById('score-display').innerText = score;
    document.getElementById('orbs-display').innerText = orbsCollected;
    document.getElementById('combo-display').innerText = `x${combo}`;
};

// Minimap constants
const MAP_SIZE = 200;
const MAP_HALF = 100;
const MAP_SCALE = 0.06;
const VIEW_RANGE = 5;

export const updateDashboardUI = (kmh, gearIndex, rpm, car, heading, orbs) => {
    // --- Speed / gear / RPM ---
    document.getElementById('speed-text').innerText = Math.round(kmh);
    document.getElementById('gear-text').innerText =
        gearIndex === 0 && kmh < 1
            ? 'N'
            : (keys.s && kmh < 10 ? 'R' : `G${gearIndex + 1}`);
    document.getElementById('rpm-bar').style.width =
        `${Math.max(0, Math.min(100, (rpm / 8000) * 100))}%`;

    // ====== MINIMAP ======
    const cvs = document.getElementById('minimap');
    const ctx = cvs.getContext('2d');
    const cx = car.position.x;
    const cz = car.position.z;

    // Clear with dark background
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Save context, translate so car is at center, rotate so heading is up
    ctx.save();
    ctx.translate(MAP_HALF, MAP_HALF);
    ctx.rotate(-heading);

    // --- Draw roads (dark surface) ---
    const cityHalf = (blocksPerSide / 2) * pitch;
    const cityPx = cityHalf * 2 * MAP_SCALE;
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(
        (-cityHalf - cx) * MAP_SCALE,
        (-cityHalf - cz) * MAP_SCALE,
        cityPx, cityPx
    );

    // --- Draw building blocks ---
    const playerGridX = Math.round(cx / pitch);
    const playerGridZ = Math.round(cz / pitch);
    const blockPx = blockSize * MAP_SCALE;

    for (let i = -VIEW_RANGE; i <= VIEW_RANGE; i++) {
        for (let j = -VIEW_RANGE; j <= VIEW_RANGE; j++) {
            const bx = playerGridX + i;
            const bz = playerGridZ + j;

            if (Math.abs(bx) <= 1 && Math.abs(bz) <= 1) continue;
            if (Math.abs(bx) > blocksPerSide / 2 || Math.abs(bz) > blocksPerSide / 2) continue;

            const drawX = (bx * pitch - cx) * MAP_SCALE - blockPx / 2;
            const drawY = (bz * pitch - cz) * MAP_SCALE - blockPx / 2;

            const hash = Math.abs(Math.sin(bx * 127.1 + bz * 311.7) * 43758.5453) % 1;
            const brightness = Math.floor(35 + hash * 30);
            ctx.fillStyle = `rgb(${brightness},${brightness},${brightness + 5})`;
            ctx.fillRect(drawX, drawY, blockPx, blockPx);

            ctx.strokeStyle = 'rgba(80, 85, 95, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(drawX, drawY, blockPx, blockPx);
        }
    }

    // --- Draw orbs ---
    if (orbs?.length) {
        for (const orb of orbs) {
            if (!orb.userData.active) continue;
            const ox = (orb.position.x - cx) * MAP_SCALE;
            const oy = (orb.position.z - cz) * MAP_SCALE;
            if (Math.abs(ox) < MAP_HALF && Math.abs(oy) < MAP_HALF) {
                ctx.beginPath();
                ctx.arc(ox, oy, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#00ffcc';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(ox, oy, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 255, 204, 0.15)';
                ctx.fill();
            }
        }
    }

    ctx.restore();

    // --- Player icon (always centered, always points up) ---
    ctx.save();
    ctx.translate(MAP_HALF, MAP_HALF);

    // View cone
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-14, -28);
    ctx.lineTo(14, -28);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 255, 204, 0.08)';
    ctx.fill();

    // Car arrow
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(-4, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fillStyle = '#00ffcc';
    ctx.fill();
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();

    // --- Compass indicator ---
    ctx.save();
    ctx.translate(MAP_HALF, MAP_HALF);
    ctx.rotate(-heading);

    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('N', 0, -MAP_HALF + 12);

    ctx.restore();

    // Remove the CSS rotation (we handle it in canvas now)
    cvs.style.transform = '';
};
