// ==========================================
// CAMERA — Chase / Hood / Top / Cinematic
// ==========================================
import * as THREE from 'three';

const camModes = ['chase', 'hood', 'top', 'cinematic'];
let curCam = 0;

export const toggleCamera = () => {
    curCam = (curCam + 1) % camModes.length;
};

export const updateCamera = (camera, car) => {
    let idealOffset, lookAtTarget;

    switch (camModes[curCam]) {
        case 'chase': {
            idealOffset = new THREE.Vector3(0, 4, -10);
            idealOffset.applyQuaternion(car.quaternion);
            idealOffset.add(car.position);
            camera.position.lerp(idealOffset, 0.12);
            lookAtTarget = car.position.clone().add(
                new THREE.Vector3(0, 0, 10).applyQuaternion(car.quaternion)
            );
            break;
        }
        case 'hood': {
            idealOffset = new THREE.Vector3(0, 1.3, 0.8);
            idealOffset.applyQuaternion(car.quaternion);
            idealOffset.add(car.position);
            camera.position.copy(idealOffset);
            lookAtTarget = car.position.clone().add(
                new THREE.Vector3(0, 0, 20).applyQuaternion(car.quaternion)
            );
            break;
        }
        case 'top': {
            idealOffset = new THREE.Vector3(0, 70, 0);
            idealOffset.add(car.position);
            camera.position.lerp(idealOffset, 0.08);
            lookAtTarget = car.position;
            break;
        }
        case 'cinematic': {
            const angle = Date.now() * 0.0002;
            idealOffset = new THREE.Vector3(Math.sin(angle) * 15, 8, Math.cos(angle) * 15);
            idealOffset.add(car.position);
            camera.position.lerp(idealOffset, 0.05);
            lookAtTarget = car.position;
            break;
        }
    }

    camera.lookAt(lookAtTarget);
};
