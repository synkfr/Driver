import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const buildSupercar = (scene) => {
    const car = new THREE.Group();
    scene.add(car);

    const chassis = new THREE.Group();
    car.add(chassis);

    const wheels = [];
    const frontWheels = [];
    const headlights = [];

    const tailLightMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
    const tailLightBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.06, 0.04), tailLightMat
    );
    tailLightBar.position.set(0, 0.7, -2.4);
    chassis.add(tailLightBar);

    for (const x of [-0.65, 0.65]) {
        const spot = new THREE.SpotLight(0xffffee, 0, 160, Math.PI / 5.5, 0.5, 1);
        spot.position.set(x, 0.8, 2.5);
        const target = new THREE.Object3D();
        target.position.set(x, 0, 18);
        car.add(target);
        spot.target = target;
        car.add(spot);
        headlights.push(spot);
    }

    const loader = new GLTFLoader();
    loader.load(
        'model/car.gltf',
        (gltf) => {
            const model = gltf.scene;

            let box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 5.0 / maxDim;
            model.scale.setScalar(scale);

            box.setFromObject(model);
            box.getCenter(center);
            model.position.sub(center);

            box.setFromObject(model);
            model.position.y -= box.min.y;
            model.position.y += 0.02;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            chassis.add(model);
        },
        undefined,
        () => { buildFallbackCar(chassis); }
    );

    const buildFallbackCar = (parent) => {
        const paint = new THREE.MeshStandardMaterial({
            color: 0xcc1122, metalness: 0.7, roughness: 0.25,
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.45, 4.6), paint);
        body.position.y = 0.55;
        body.castShadow = true;
        parent.add(body);

        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.35, 2.0),
            new THREE.MeshStandardMaterial({ color: 0x112244, transparent: true, opacity: 0.4 })
        );
        cabin.position.set(0, 0.95, -0.1);
        parent.add(cabin);

        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.8), paint);
        roof.position.set(0, 1.15, -0.1);
        parent.add(roof);
    };

    const createWheel = (x, z, isFront) => {
        const steerGroup = new THREE.Group();
        steerGroup.position.set(x, 0.36, z);
        const rollGroup = new THREE.Group();
        steerGroup.add(rollGroup);

        const tire = new THREE.Mesh(
            new THREE.TorusGeometry(0.28, 0.10, 10, 20),
            new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 })
        );
        tire.rotation.y = Math.PI / 2;
        tire.castShadow = true;
        rollGroup.add(tire);

        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14),
            new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.08 })
        );
        rim.rotateZ(Math.PI / 2);
        rollGroup.add(rim);

        const hub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8),
            new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.95, roughness: 0.05 })
        );
        hub.rotateZ(Math.PI / 2);
        rollGroup.add(hub);

        car.add(steerGroup);
        wheels.push(rollGroup);
        if (isFront) frontWheels.push(steerGroup);
    };

    createWheel(-1.08, 1.45, true);
    createWheel(1.08, 1.45, true);
    createWheel(-1.12, -1.55, false);
    createWheel(1.12, -1.55, false);

    return { car, chassis, frontWheels, wheels, tailLightBar, headlights };
};
