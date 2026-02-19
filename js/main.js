// ==========================================
// MAIN — Entry point, game loop, init
// ==========================================
import * as THREE from 'three';
import { initAudio, playHonk } from './audio.js';
import { initKeyboard, setupMobileControls } from './input.js';
import { buildSupercar } from './car.js';
import { buildEnvironment, updateDayNight, toggleNight } from './environment.js';
import { updateParticles, updateSkidMarks } from './particles.js';
import { toggleCamera, updateCamera } from './camera.js';
import { updateScoreDisplay } from './ui.js';
import { spawnCollectibles, updateCollectibles } from './collectibles.js';
import { updatePhysics } from './physics.js';
import { initMultiplayer, updateMultiplayer } from './multiplayer.js';
import '../css/styles.css';

// --- Game State ---
const gameState = {
    started: false,
    score: 0,
    orbsCollected: 0,
    combo: 1,
    comboTimer: 0,
    nitro: 100,
    maxNitro: 100,
    nitroRegenRate: 5,
    isNitroActive: false,
};

let scene, camera, renderer, clock;
let carParts;

// ==========================================
// INIT
// ==========================================
const initGame = () => {
    if (gameState.started) return;
    gameState.started = true;
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('ui-layer').style.display = 'block';

    initAudio();
    init3D();
    setupMobileControls();
};

// Expose initGame for the onclick handler
window.initGame = initGame;

const init3D = () => {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdde5ed);
    scene.fog = new THREE.FogExp2(0xdde5ed, 0.0012);

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2500);
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    buildEnvironment(scene);
    carParts = buildSupercar(scene);
    spawnCollectibles(scene);

    initKeyboard(toggleCamera, toggleNight, playHonk);

    // Multiplayer — connect to LAN server
    initMultiplayer(scene);

    animate();
};

// ==========================================
// GAME LOOP
// ==========================================
const animate = () => {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.1);

    updatePhysics(delta, gameState, carParts, scene);
    updateParticles(scene, delta);
    updateSkidMarks(scene, delta);
    updateCollectibles(delta, scene, carParts.car, gameState);
    updateDayNight(delta, carParts.car, carParts.headlights, scene);
    updateMultiplayer(carParts.car);
    updateCamera(camera, carParts.car);

    renderer.render(scene, camera);
};

// ==========================================
// RESIZE
// ==========================================
window.addEventListener('resize', () => {
    if (!camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
