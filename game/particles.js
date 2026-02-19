import * as THREE from 'three';

const smokeParticles = [];
const skidMarks = [];

let smokeGeo = null;
let smokeMat = null;
let smokeMatOrange = null;
let skidGeo = null;
let skidMat = null;

const MAX_SMOKE = 30;
const MAX_SKIDS = 60;

const ensureMaterials = () => {
    if (!smokeGeo) {
        smokeGeo = new THREE.BoxGeometry(1.0, 0.6, 1.0);
        smokeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.4 });
        smokeMatOrange = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
        skidGeo = new THREE.PlaneGeometry(0.4, 1.8);
        skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    }
};

export const spawnSmoke = (scene, x, z, amount, color) => {
    ensureMaterials();
    if (smokeParticles.length >= MAX_SMOKE) return;

    const count = Math.min(amount, MAX_SMOKE - smokeParticles.length);
    const mat = (color === 0xff8800) ? smokeMatOrange : smokeMat;

    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(smokeGeo, mat.clone());
        p.position.set(x + (Math.random() - 0.5) * 1.5, 0.2, z + (Math.random() - 0.5) * 1.5);
        p.rotation.set(Math.random(), Math.random(), Math.random());
        p.life = 0.8;
        p.upVelocity = 0.08 + Math.random() * 0.04;
        scene.add(p);
        smokeParticles.push(p);
    }
};

export const updateParticles = (scene, delta) => {
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i];
        p.life -= delta * 1.5;
        p.position.y += p.upVelocity;
        p.scale.multiplyScalar(1.03);
        p.material.opacity = p.life * 0.4;
        if (p.life <= 0) {
            scene.remove(p);
            p.material.dispose();
            smokeParticles.splice(i, 1);
        }
    }
};

export const addSkidMark = (scene, x, z, rotation) => {
    ensureMaterials();

    if (skidMarks.length >= MAX_SKIDS) {
        const old = skidMarks.shift();
        scene.remove(old);
        old.material.dispose();
    }

    const mark = new THREE.Mesh(skidGeo, skidMat.clone());
    mark.position.set(x, 0.02, z);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = rotation;
    mark.life = 4.0;
    scene.add(mark);
    skidMarks.push(mark);
};

export const updateSkidMarks = (scene, delta) => {
    for (let i = skidMarks.length - 1; i >= 0; i--) {
        const mark = skidMarks[i];
        mark.life -= delta;
        mark.material.opacity = (mark.life / 4.0) * 0.6;
        if (mark.life <= 0) {
            scene.remove(mark);
            mark.material.dispose();
            skidMarks.splice(i, 1);
        }
    }
};
