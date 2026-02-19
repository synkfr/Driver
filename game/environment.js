// ==========================================
// ENVIRONMENT — City grid, lighting, day/night
// ==========================================
import * as THREE from 'three';

export const blockSize = 140;
export const roadWidth = 40;
export const pitch = blockSize + roadWidth;
export const blocksPerSide = 20;
export const cityWidth = blocksPerSide * pitch;
export let timeOfDay = 14;

let sunLight, ambientLight;

export const buildEnvironment = (scene) => {
    ambientLight = new THREE.HemisphereLight(0xffffff, 0x888899, 0.6);
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    sunLight.castShadow = true;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -100;
    sunLight.shadow.camera.right = 100;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // --- Ground with road markings ---
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#151518';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#33333a';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512);
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    const roadTex = new THREE.CanvasTexture(canvas);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(blocksPerSide, blocksPerSide);

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(cityWidth, cityWidth),
        new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- City blocks & buildings ---
    const totalBlocks = blocksPerSide * blocksPerSide;

    const blockGeo = new THREE.BoxGeometry(blockSize, 1, blockSize);
    blockGeo.translate(0, 0.5, 0);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1.0 });
    const sidewalks = new THREE.InstancedMesh(blockGeo, blockMat, totalBlocks);
    sidewalks.receiveShadow = true;
    scene.add(sidewalks);

    const bldgGeo = new THREE.BoxGeometry(1, 1, 1);
    bldgGeo.translate(0, 0.5, 0);
    const bldgMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.1 });
    const buildings = new THREE.InstancedMesh(bldgGeo, bldgMat, totalBlocks * 3);
    buildings.castShadow = true;
    buildings.receiveShadow = true;
    scene.add(buildings);

    const dummy = new THREE.Object3D();
    const bColor = new THREE.Color();
    let sIdx = 0, bIdx = 0;
    const bColors = [0xffffff, 0xeef2f5, 0xd0d5db, 0x111111, 0x00ffcc];

    for (let ix = -blocksPerSide / 2; ix < blocksPerSide / 2; ix++) {
        for (let iz = -blocksPerSide / 2; iz < blocksPerSide / 2; iz++) {
            const cx = ix * pitch;
            const cz = iz * pitch;

            if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) continue;

            dummy.position.set(cx, 0, cz);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            sidewalks.setMatrixAt(sIdx++, dummy.matrix);

            const numShapes = Math.floor(Math.random() * 3) + 1;
            for (let i = 0; i < numShapes; i++) {
                const bw = 30 + Math.random() * 50;
                const bd = 30 + Math.random() * 50;
                const bh = 30 + Math.pow(Math.random(), 3) * 300;

                const ox = (Math.random() - 0.5) * (blockSize - bw);
                const oz = (Math.random() - 0.5) * (blockSize - bd);

                dummy.position.set(cx + ox, 1, cz + oz);
                dummy.scale.set(bw, bh, bd);
                dummy.updateMatrix();
                buildings.setMatrixAt(bIdx, dummy.matrix);

                bColor.setHex(
                    bh > 150
                        ? (Math.random() > 0.9 ? 0x00ffcc : 0x111111)
                        : bColors[Math.floor(Math.random() * 4)]
                );
                buildings.setColorAt(bIdx++, bColor);
            }
        }
    }
    sidewalks.count = sIdx;
    buildings.count = bIdx;
    buildings.instanceMatrix.needsUpdate = true;
    buildings.instanceColor.needsUpdate = true;
};

export const updateDayNight = (delta, car, headlights, scene) => {
    timeOfDay += delta * 0.02;
    if (timeOfDay > 24) timeOfDay = 0;

    const sunAngle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    sunLight.position.x = car.position.x + Math.cos(sunAngle) * 150;
    sunLight.position.z = car.position.z + 50;
    sunLight.position.y = Math.max(20, Math.sin(sunAngle) * 150);
    sunLight.target = car;

    const isNight = timeOfDay < 6 || timeOfDay > 18;
    if (isNight) {
        sunLight.intensity = 0.0;
        ambientLight.intensity = 0.15;
        scene.fog.color.setHex(0x0a0a0c);
        scene.background.setHex(0x0a0a0c);
        headlights.forEach((hl) => { hl.intensity = 6; });
    } else {
        sunLight.intensity = Math.max(0, Math.sin(sunAngle) * 1.5);
        ambientLight.intensity = 0.6;
        scene.fog.color.setHex(0xdde5ed);
        scene.background.setHex(0xdde5ed);
        headlights.forEach((hl) => { hl.intensity = 0; });
    }
};

export const toggleNight = () => {
    timeOfDay = timeOfDay < 12 ? 22 : 12;
};
