import * as THREE from 'three';
import { blocksPerSide, pitch, roadWidth } from './environment.js';
import { spawnSmoke } from './particles.js';

const maxOrbs = 30;
export const orbs = [];

export const spawnCollectibles = (scene) => {
    const orbGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8 });

    for (let i = 0; i < maxOrbs; i++) {
        const orb = new THREE.Mesh(orbGeo, orbMat.clone());
        let gridX = Math.floor(Math.random() * blocksPerSide) - blocksPerSide / 2;
        const gridZ = Math.floor(Math.random() * blocksPerSide) - blocksPerSide / 2;
        if (Math.abs(gridX) <= 2 && Math.abs(gridZ) <= 2) gridX += 5;

        orb.position.set(
            gridX * pitch + (Math.random() - 0.5) * roadWidth * 0.8,
            2,
            gridZ * pitch + (Math.random() - 0.5) * roadWidth * 0.8
        );
        orb.userData.rotSpeed = 0.5 + Math.random() * 1;
        orb.userData.floatOffset = Math.random() * Math.PI * 2;
        orb.userData.active = true;
        scene.add(orb);
        orbs.push(orb);
    }
};

const collectOrb = (orb, scene, gameState) => {
    orb.userData.active = false;
    orb.visible = false;
    gameState.orbsCollected++;
    gameState.score += 100 * gameState.combo;
    gameState.combo = Math.min(gameState.combo + 1, 10);
    gameState.comboTimer = 3.0;
    spawnSmoke(scene, orb.position.x, orb.position.z, 6, 0x00ffcc);

    setTimeout(() => {
        let gridX = Math.floor(Math.random() * blocksPerSide) - blocksPerSide / 2;
        const gridZ = Math.floor(Math.random() * blocksPerSide) - blocksPerSide / 2;
        if (Math.abs(gridX) <= 2 && Math.abs(gridZ) <= 2) gridX += 5;
        orb.position.set(
            gridX * pitch + (Math.random() - 0.5) * roadWidth * 0.8,
            2,
            gridZ * pitch + (Math.random() - 0.5) * roadWidth * 0.8
        );
        orb.userData.active = true;
        orb.visible = true;
    }, 2000);
};

export const updateCollectibles = (delta, scene, car, gameState) => {
    for (const orb of orbs) {
        if (!orb.userData.active) continue;
        orb.rotation.y += delta * orb.userData.rotSpeed;
        orb.userData.floatOffset += delta * 2;
        orb.position.y = 2 + Math.sin(orb.userData.floatOffset) * 0.5;
        orb.material.opacity = 0.6 + Math.sin(orb.userData.floatOffset * 2) * 0.2;
        if (car.position.distanceTo(orb.position) < 3) collectOrb(orb, scene, gameState);
    }
};
