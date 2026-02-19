// ==========================================
// PHYSICS — Forza Horizon-style vehicle dynamics
// ==========================================
// Tuned for smooth, weighty, realistic feel:
// - Gradual steering with heavy inertia
// - Tire grip curve (Pacejka-inspired)
// - Weight transfer front/rear
// - Progressive understeer at speed
// - Controlled oversteer on handbrake
// - Smooth suspension with body roll/pitch
import * as THREE from 'three';
import { keys } from './input.js';
import { updateAudio } from './audio.js';
import { spawnSmoke, addSkidMark } from './particles.js';
import { updateScoreDisplay, updateDashboardUI } from './ui.js';
import { pitch, blockSize, blocksPerSide } from './environment.js';
import { orbs } from './collectibles.js';

// --- Transmission ---
export const transmission = {
    gears: [
        { r: 3.5, max: 35 },   // 1st
        { r: 2.4, max: 70 },   // 2nd
        { r: 1.7, max: 110 },  // 3rd
        { r: 1.2, max: 160 },  // 4th
        { r: 0.9, max: 210 },  // 5th
        { r: 0.75, max: 260 }, // 6th
    ],
    current: 0,
    rpm: 800,
};

// --- Forza-style tuning constants ---
export const physics = {
    // Power & speed
    maxSpeed: 260,
    baseAccel: 32,
    braking: 65,
    engineBraking: 10,

    // Friction & resistance
    rollingFriction: 0.993,
    airDrag: 0.00018,

    // Steering — responsive but smooth
    wheelBase: 3.0,
    maxSteer: 0.38,
    steerSpeed: 2.5,
    steerReturn: 3.5,
    steerDamping: 0.80,

    // Grip model (Pacejka-inspired)
    frontGrip: 1.0,
    rearGrip: 0.95,
    gripCurve: 0.85,
    peakSlipAngle: 0.10,
    slideSlipAngle: 0.40,
    lateralStiffness: 3.0,

    // Drift / handbrake
    handbrakeRearGrip: 0.20,
    handbrakeDecay: 0.965,

    // Nitro
    nitroBoost: 75,
    nitroDrain: 16,

    // Suspension
    suspensionStiffness: 5.0,
    suspensionDamping: 0.90,
    maxPitch: 0.05,
    maxRoll: 0.06,

    // Weight distribution (rear-biased sports car)
    weightFront: 0.46,
    weightTransferRate: 0.10,
};

// --- State ---
export const velocity = new THREE.Vector3(0, 0, 0);
export let heading = 0;
export let steeringAngle = 0;

let skidMarkTimer = 0;

// Suspension state
let suspensionPitch = 0;
let suspensionRoll = 0;
let suspensionPitchVel = 0;
let suspensionRollVel = 0;

// Weight transfer state
let frontLoad = 0.48;
let rearLoad = 0.52;

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;

// Simple Pacejka-like grip curve
const tireGripCurve = (slipAngle, peakSlip, slideSlip, curveFalloff) => {
    const absSlip = Math.abs(slipAngle);
    if (absSlip < peakSlip) {
        return absSlip / peakSlip;
    } else if (absSlip < slideSlip) {
        const t = (absSlip - peakSlip) / (slideSlip - peakSlip);
        return 1.0 - t * (1.0 - curveFalloff);
    } else {
        return curveFalloff * 0.7;
    }
};

const getCollisionNormal = (pos) => {
    const gridX = Math.round(pos.x / pitch);
    const gridZ = Math.round(pos.z / pitch);

    if (Math.abs(gridX) <= 1 && Math.abs(gridZ) <= 1) return null;
    if (Math.abs(gridX) > blocksPerSide / 2 || Math.abs(gridZ) > blocksPerSide / 2) {
        const nx = pos.x > 0 ? -1 : (pos.x < 0 ? 1 : 0);
        const nz = pos.z > 0 ? -1 : (pos.z < 0 ? 1 : 0);
        const len = Math.sqrt(nx * nx + nz * nz) || 1;
        return new THREE.Vector3(nx / len, 0, nz / len);
    }

    const blockCenterX = gridX * pitch;
    const blockCenterZ = gridZ * pitch;
    const dx = pos.x - blockCenterX;
    const dz = pos.z - blockCenterZ;
    const half = (blockSize / 2) + 2.0;

    if (Math.abs(dx) < half && Math.abs(dz) < half) {
        const penX = half - Math.abs(dx);
        const penZ = half - Math.abs(dz);
        if (penX < penZ) {
            return new THREE.Vector3(dx > 0 ? 1 : -1, 0, 0);
        } else {
            return new THREE.Vector3(0, 0, dz > 0 ? 1 : -1);
        }
    }
    return null;
};

// ==========================================
// MAIN PHYSICS UPDATE
// ==========================================
export const updatePhysics = (delta, gameState, carParts, scene) => {
    const { car, chassis, frontWheels, wheels, tailLightBar } = carParts;
    const phys = physics;
    const trans = transmission;

    delta = Math.min(delta, 0.05);

    // --- Combo timer ---
    if (gameState.comboTimer > 0) {
        gameState.comboTimer -= delta;
        if (gameState.comboTimer <= 0) {
            gameState.combo = 1;
            updateScoreDisplay(gameState.score, gameState.orbsCollected, gameState.combo);
        }
    }

    // --- Directional vectors ---
    let carForward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    let carRight = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    let forwardSpeed = velocity.dot(carForward);
    let lateralSpeed = velocity.dot(carRight);
    const absSpeed = Math.abs(forwardSpeed);
    const totalSpeed = velocity.length();
    const speedFactor = clamp(totalSpeed / phys.maxSpeed, 0, 1);

    // ========== NFS/FORZA-STYLE STEERING ==========
    const speedSteerReduction = 1.0 - speedFactor * 0.75;
    const effectiveMaxSteer = phys.maxSteer * speedSteerReduction;

    const steerInput = (keys.a ? 1 : 0) + (keys.d ? -1 : 0);
    const targetAngle = steerInput * effectiveMaxSteer;

    let rampRate;
    if (steerInput !== 0) {
        rampRate = phys.steerSpeed * delta;
    } else {
        rampRate = phys.steerReturn * (0.5 + speedFactor * 1.5) * delta;
    }

    steeringAngle = lerp(steeringAngle, targetAngle, clamp(rampRate, 0, 1));
    frontWheels.forEach((w) => { w.rotation.y = steeringAngle; });

    // --- Nitro management ---
    gameState.isNitroActive = keys.shift && gameState.nitro > 0 && keys.w;
    if (gameState.isNitroActive) {
        gameState.nitro = Math.max(0, gameState.nitro - phys.nitroDrain * delta);
    } else {
        gameState.nitro = Math.min(gameState.maxNitro, gameState.nitro + gameState.nitroRegenRate * delta);
    }
    document.getElementById('nitro-bar').style.width = `${(gameState.nitro / gameState.maxNitro * 100)}%`;

    // ========== WEIGHT TRANSFER ==========
    let accelG = 0;
    if (keys.w) accelG = 0.3;
    if (keys.s) accelG = -0.5;
    const weightShift = accelG * phys.weightTransferRate;
    frontLoad = lerp(frontLoad, phys.weightFront - weightShift, delta * 3);
    rearLoad = 1.0 - frontLoad;

    // ========== THRUST ==========
    let thrust = 0;
    const gear = trans.gears[trans.current];
    const rawThrust = phys.baseAccel * gear.r;

    if (keys.w) {
        const rpmEfficiency = 1.0 - Math.pow(clamp((trans.rpm - 6500) / 1500, 0, 1), 2) * 0.3;
        thrust += rawThrust * rpmEfficiency;
        if (gameState.isNitroActive) thrust += phys.nitroBoost;
    } else if (!keys.s) {
        if (absSpeed > 1) thrust -= phys.engineBraking * Math.sign(forwardSpeed);
    }

    if (keys.s) {
        thrust -= phys.braking;
    }

    if (keys.space) {
        thrust = 0;
    }

    // ========== TRACTION LIMIT ==========
    const tractionForce = rearLoad * 2.0 * rawThrust;
    if (thrust > 0) thrust = Math.min(thrust, tractionForce + (gameState.isNitroActive ? phys.nitroBoost : 0));

    // --- RPM ---
    let targetRpm = 800 + (absSpeed / gear.max) * 7200;
    if (gameState.isNitroActive) targetRpm += 800;
    trans.rpm = lerp(trans.rpm, targetRpm, delta * 8);

    // --- Gear shifting ---
    if (absSpeed > gear.max * 0.93 && trans.current < trans.gears.length - 1) {
        trans.current++;
        trans.rpm = 4500;
    } else if (
        trans.current > 0 &&
        absSpeed < trans.gears[trans.current - 1].max * 0.70
    ) {
        trans.current--;
    }

    // ========== SLIP ANGLE & TIRE GRIP ==========
    const slipAngle = totalSpeed > 1
        ? Math.atan2(lateralSpeed, Math.abs(forwardSpeed))
        : 0;
    const absSlip = Math.abs(slipAngle);

    const frontGripMult = tireGripCurve(slipAngle, phys.peakSlipAngle, phys.slideSlipAngle, phys.gripCurve);
    const rearGripMult = tireGripCurve(slipAngle, phys.peakSlipAngle, phys.slideSlipAngle, phys.gripCurve);

    let effectiveFrontGrip = phys.frontGrip * frontGripMult * frontLoad * 2;
    let effectiveRearGrip = phys.rearGrip * rearGripMult * rearLoad * 2;

    let isDrifting = false;
    const isBraking = keys.s && forwardSpeed > 5;

    if (keys.space && absSpeed > 8) {
        effectiveRearGrip *= phys.handbrakeRearGrip;
        isDrifting = true;
    }

    if (absSlip > phys.peakSlipAngle * 1.5) {
        isDrifting = true;
    }

    const avgGrip = (effectiveFrontGrip + effectiveRearGrip) * 0.5;
    const currentGrip = clamp(avgGrip, 0.15, 1.0);

    // ========== EFFECTS: SMOKE & SKID MARKS ==========
    if (isDrifting && absSpeed > 25) {
        spawnSmoke(scene, car.position.x - carForward.x * 2, car.position.z - carForward.z * 2, 1);
        skidMarkTimer += delta;
        if (skidMarkTimer > 0.18) {
            const rearOff = carForward.clone().multiplyScalar(-1.6);
            const sideR = carRight.clone().multiplyScalar(1.0);
            const sideL = carRight.clone().multiplyScalar(-1.0);

            addSkidMark(scene,
                car.position.x + rearOff.x + sideL.x,
                car.position.z + rearOff.z + sideL.z,
                heading
            );
            addSkidMark(scene,
                car.position.x + rearOff.x + sideR.x,
                car.position.z + rearOff.z + sideR.z,
                heading
            );
            skidMarkTimer = 0;
        }
    }

    // Drift scoring
    if (isDrifting && absSpeed > 25) {
        gameState.score += Math.floor(absSpeed * 0.04 * gameState.combo);
    }

    // --- Audio ---
    updateAudio(trans.rpm, isDrifting, isBraking, gameState.isNitroActive, absSpeed, steeringAngle);

    // --- Brake / tail lights ---
    tailLightBar.material.color.setHex((keys.s || keys.space) ? 0xff0022 : 0x440000);

    // ========== APPLY VEHICLE DYNAMICS ==========
    if (absSpeed > 0.3) {
        let turnRate = (forwardSpeed * Math.tan(steeringAngle)) / phys.wheelBase;
        turnRate *= clamp(effectiveFrontGrip, 0.3, 1.0);
        heading += turnRate * delta;
    }
    carForward.set(Math.sin(heading), 0, Math.cos(heading));
    carRight.set(Math.cos(heading), 0, -Math.sin(heading));

    velocity.add(carForward.clone().multiplyScalar(thrust * delta));

    // ========== RESISTANCE FORCES ==========
    velocity.multiplyScalar(keys.space ? phys.handbrakeDecay : phys.rollingFriction);

    if (totalSpeed > 5) {
        const dragForce = phys.airDrag * totalSpeed * totalSpeed;
        const dragDecel = Math.min(dragForce * delta, totalSpeed * 0.5);
        velocity.sub(velocity.clone().normalize().multiplyScalar(dragDecel));
    }

    const maxCurrentSpeed = gameState.isNitroActive ? phys.maxSpeed * 1.3 : phys.maxSpeed;
    if (velocity.length() > maxCurrentSpeed) velocity.setLength(maxCurrentSpeed);

    // ========== LATERAL GRIP CORRECTION ==========
    forwardSpeed = velocity.dot(carForward);
    lateralSpeed = velocity.dot(carRight);

    let lateralReduction = currentGrip * phys.lateralStiffness * delta;
    lateralReduction = clamp(lateralReduction, 0, 0.85);

    const correctedLateral = lateralSpeed * (1.0 - lateralReduction);

    velocity.copy(
        carForward.clone().multiplyScalar(forwardSpeed).add(
            carRight.clone().multiplyScalar(correctedLateral)
        )
    );

    // ========== WALL-SLIDE COLLISION ==========
    const nextPos = car.position.clone().add(velocity.clone().multiplyScalar(delta));
    const normal = getCollisionNormal(nextPos);

    if (normal) {
        const velIntoWall = velocity.dot(normal);
        if (velIntoWall < 0) {
            velocity.sub(normal.clone().multiplyScalar(velIntoWall * 1.1));
            const impactLoss = clamp(1.0 - Math.abs(velIntoWall) * 0.005, 0.7, 0.95);
            velocity.multiplyScalar(impactLoss);
            spawnSmoke(scene, car.position.x + normal.x * 2, car.position.z + normal.z * 2, 2, 0xff8800);
        }

        if (Math.abs(velIntoWall) > 20) {
            gameState.combo = 1;
            gameState.comboTimer = 0;
            updateScoreDisplay(gameState.score, gameState.orbsCollected, gameState.combo);
        }

        car.position.add(normal.clone().multiplyScalar(0.5));
    } else {
        car.position.copy(nextPos);
    }
    car.rotation.y = heading;

    // ========== WHEEL ROTATION ==========
    const wheelForwardSpeed = velocity.dot(carForward);
    wheels.forEach((w) => { w.rotation.x += wheelForwardSpeed * delta * 0.6; });

    // ========== SUSPENSION (SPRING-DAMPER) ==========
    const longitudinalG = thrust * 0.0004;
    const yawRate = absSpeed > 0.3
        ? (forwardSpeed * Math.tan(steeringAngle)) / phys.wheelBase
        : 0;
    const lateralG = yawRate * absSpeed * 0.00025;

    const pitchTarget = clamp(-longitudinalG, -phys.maxPitch, phys.maxPitch);
    const rollTarget = clamp(-lateralG, -phys.maxRoll, phys.maxRoll);

    suspensionPitchVel += (pitchTarget - suspensionPitch) * phys.suspensionStiffness * delta;
    suspensionRollVel += (rollTarget - suspensionRoll) * phys.suspensionStiffness * delta;
    suspensionPitchVel *= phys.suspensionDamping;
    suspensionRollVel *= phys.suspensionDamping;
    suspensionPitch += suspensionPitchVel;
    suspensionRoll += suspensionRollVel;

    chassis.rotation.x = suspensionPitch;
    chassis.rotation.z = suspensionRoll;

    // --- Dashboard ---
    updateDashboardUI(absSpeed * 3.6, trans.current, trans.rpm, car, heading, orbs);
};
