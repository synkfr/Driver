import { Vec3, clamp, lerp } from './MathUtils.js';
import { VehicleBody } from './VehicleBody.js';
import { Wheel } from './Wheel.js';
import { EngineUnit } from './Engine.js';
import { Transmission } from './Transmission.js';
import { Aerodynamics } from './Aerodynamics.js';
import { Steering } from './Steering.js';
import { Assists } from './Assists.js';
import { DamageModel } from './DamageModel.js';
import { AntiRollBar } from './Suspension.js';
import { Weather } from './Weather.js';
import { CollisionBridge } from './CollisionBridge.js';

const GRAVITY = 9.81;
const FIXED_DT = 1.0 / 120.0;
const MAX_SUBSTEPS = 8;

export class Vehicle {
    constructor(config = {}) {
        this.body = new VehicleBody(config.body);

        const wb = this.body.wheelBase;
        const tw = this.body.trackWidth;

        this.wheels = [
            new Wheel({ x: -tw / 2, y: 0, z: wb / 2, isSteered: true, isDriven: false, ...config.wheelFL }),
            new Wheel({ x: tw / 2, y: 0, z: wb / 2, isSteered: true, isDriven: false, ...config.wheelFR }),
            new Wheel({ x: -tw / 2, y: 0, z: -wb / 2, isSteered: false, isDriven: true, ...config.wheelRL }),
            new Wheel({ x: tw / 2, y: 0, z: -wb / 2, isSteered: false, isDriven: true, ...config.wheelRR }),
        ];

        this.engine = new EngineUnit(config.engine);
        this.transmission = new Transmission(config.transmission);
        this.aero = new Aerodynamics(config.aero);
        this.steering = new Steering({ wheelBase: wb, trackWidth: tw, ...config.steering });
        this.assists = new Assists(config.assists);
        this.damage = new DamageModel(config.damage);

        this.frontARB = new AntiRollBar(config.frontARBStiffness || 12000);
        this.rearARB = new AntiRollBar(config.rearARBStiffness || 10000);

        this.input = { throttle: 0, brake: 0, steer: 0, handbrake: false, nitro: false };

        this.nitro = config.nitro || 100;
        this.maxNitro = config.maxNitro || 100;
        this.nitroDrain = config.nitroDrain || 16;
        this.nitroRegen = config.nitroRegen || 5;
        this.nitroBoostForce = config.nitroBoostForce || 75;
        this.isNitroActive = false;

        this.isDrifting = false;
        this.driftAngle = 0;

        this.maxSpeed = config.maxSpeed || 260;
        this.baseAccel = config.baseAccel || 32;
        this.brakingForce = config.brakingForce || 65;
        this.engineBrakingForce = config.engineBrakingForce || 10;
        this.rollingFriction = 0.993;
        this.airDrag = 0.00018;
        this.lateralStiffness = 3.0;

        this.frontGrip = 1.0;
        this.rearGrip = 0.95;
        this.gripCurve = 0.85;
        this.peakSlipAngle = 0.10;
        this.slideSlipAngle = 0.40;
        this.handbrakeRearGrip = 0.20;
        this.handbrakeDecay = 0.965;

        this.suspensionStiffness = 5.0;
        this.suspensionDamping = 0.90;
        this.maxPitch = 0.05;
        this.maxRoll = 0.06;

        this.suspensionPitch = 0;
        this.suspensionRoll = 0;
        this.suspensionPitchVel = 0;
        this.suspensionRollVel = 0;
        this.frontLoad = 0.48;

        this.steeringAngle = 0;
        this.maxSteer = 0.38;
        this.steerSpeed = 2.5;
        this.steerReturn = 3.5;
    }

    get position() { return this.body.position; }
    get heading() { return this.body.heading; }
    set heading(v) { this.body.heading = v; }
    get speed() { return this.body.getSpeed(); }
    get speedKmh() { return this.body.getSpeedKmh(); }
    get forwardSpeed() { return this.body.getForwardSpeed(); }
    get rpm() { return this.engine.rpm; }
    get gear() { return this.transmission.displayGear; }
    get gearIndex() { return this.transmission.currentGear; }

    reset(x, y, z) {
        this.body.reset(x, y, z);
        this.wheels.forEach(w => w.reset());
        this.engine.reset();
        this.transmission.reset();
        this.steering.reset();
        this.assists.reset();
        this.damage.reset();
        this.aero.reset();
        this.nitro = this.maxNitro;
        this.isNitroActive = false;
        this.isDrifting = false;
        this.steeringAngle = 0;
        this.suspensionPitch = 0;
        this.suspensionRoll = 0;
        this.suspensionPitchVel = 0;
        this.suspensionRollVel = 0;
        this.frontLoad = 0.48;
    }
}

export class PhysicsWorld {
    constructor(config = {}) {
        this.fixedDt = config.fixedDt || FIXED_DT;
        this.gravity = config.gravity || GRAVITY;
        this.accumulator = 0;
        this.tickCount = 0;

        this.vehicles = [];
        this.weather = new Weather();
        this.collision = new CollisionBridge(config.collision);

        this.telemetry = null;
    }

    addVehicle(vehicle) {
        this.vehicles.push(vehicle);
        return vehicle;
    }

    createVehicle(config) {
        const v = new Vehicle(config);
        return this.addVehicle(v);
    }

    step(renderDelta) {
        this.accumulator += Math.min(renderDelta, 0.1);
        let steps = 0;

        while (this.accumulator >= this.fixedDt && steps < MAX_SUBSTEPS) {
            this.fixedStep(this.fixedDt);
            this.accumulator -= this.fixedDt;
            this.tickCount++;
            steps++;
        }
    }

    fixedStep(dt) {
        for (const vehicle of this.vehicles) {
            this.updateVehicle(vehicle, dt);
        }
    }

    tireGripCurve(slipAngle, peakSlip, slideSlip, curveFalloff) {
        const absSlip = Math.abs(slipAngle);
        if (absSlip < peakSlip) return absSlip / peakSlip;
        if (absSlip < slideSlip) {
            const t = (absSlip - peakSlip) / (slideSlip - peakSlip);
            return 1.0 - t * (1.0 - curveFalloff);
        }
        return curveFalloff * 0.7;
    }

    updateVehicle(v, dt) {
        const body = v.body;
        const input = v.input;

        let carForward = body.getForwardDir();
        let carRight = body.getRightDir();
        let forwardSpeed = body.linearVelocity.dot(carForward);
        let lateralSpeed = body.linearVelocity.dot(carRight);
        const absSpeed = Math.abs(forwardSpeed);
        const totalSpeed = body.linearVelocity.length();
        const speedFactor = clamp(totalSpeed / v.maxSpeed, 0, 1);

        const speedSteerReduction = 1.0 - speedFactor * 0.75;
        const effectiveMaxSteer = v.maxSteer * speedSteerReduction * v.damage.getSteeringPenalty();
        const steerInput = clamp(input.steer, -1, 1);
        const targetAngle = steerInput * effectiveMaxSteer + v.damage.getAlignmentDrift();

        let rampRate;
        if (steerInput !== 0) {
            rampRate = v.steerSpeed * dt;
        } else {
            rampRate = v.steerReturn * (0.5 + speedFactor * 1.5) * dt;
        }
        v.steeringAngle = lerp(v.steeringAngle, targetAngle, clamp(rampRate, 0, 1));

        if (v.wheels.length >= 2) {
            v.wheels[0].steerAngle = v.steeringAngle;
            v.wheels[1].steerAngle = v.steeringAngle;
        }

        v.isNitroActive = input.nitro && v.nitro > 0 && input.throttle > 0;
        if (v.isNitroActive) {
            v.nitro = Math.max(0, v.nitro - v.nitroDrain * dt);
        } else {
            v.nitro = Math.min(v.maxNitro, v.nitro + v.nitroRegen * dt);
        }

        let throttle = clamp(input.throttle, 0, 1);
        throttle *= v.damage.getPowerPenalty();

        const avgDrivenWheelSpeed = absSpeed / v.wheels[0].radius;
        const wheelFeedbackRPM = v.transmission.getWheelRPMToEngineRPM(
            avgDrivenWheelSpeed * 60 / (2 * Math.PI)
        );

        const engineTorque = v.engine.update(wheelFeedbackRPM, throttle, dt);
        v.transmission.update(v.engine.rpm, forwardSpeed, dt);

        let accelG = 0;
        if (input.throttle > 0) accelG = 0.3;
        if (input.brake > 0) accelG = -0.5;
        const weightShift = accelG * 0.10;
        v.frontLoad = lerp(v.frontLoad, 0.48 - weightShift, dt * 3);
        const rearLoad = 1.0 - v.frontLoad;

        let thrust = 0;
        const gear = v.transmission.gearRatios[v.transmission.currentGear];
        const rawThrust = v.baseAccel * Math.abs(gear || 1);

        if (input.throttle > 0) {
            const rpmEfficiency = 1.0 - Math.pow(clamp((v.engine.rpm - 6500) / 1500, 0, 1), 2) * 0.3;
            thrust += rawThrust * rpmEfficiency * throttle;
            if (v.isNitroActive) thrust += v.nitroBoostForce;
        } else if (input.brake <= 0) {
            if (absSpeed > 1) thrust -= v.engineBrakingForce * Math.sign(forwardSpeed);
        }

        if (input.brake > 0) thrust -= v.brakingForce;
        if (input.handbrake) thrust = 0;

        const tractionForce = rearLoad * 2.0 * rawThrust;
        if (thrust > 0) thrust = Math.min(thrust, tractionForce + (v.isNitroActive ? v.nitroBoostForce : 0));

        let targetRpm = 800 + (absSpeed / (v.maxSpeed / 3.6)) * 7200;
        if (v.isNitroActive) targetRpm += 800;
        v.engine.rpm = lerp(v.engine.rpm, targetRpm, dt * 8);
        v.engine.rpm = clamp(v.engine.rpm, 800, 8200);

        const slipAngle = totalSpeed > 1 ? Math.atan2(lateralSpeed, Math.abs(forwardSpeed)) : 0;
        const absSlip = Math.abs(slipAngle);

        const frontGripMult = this.tireGripCurve(slipAngle, v.peakSlipAngle, v.slideSlipAngle, v.gripCurve);
        const rearGripMult = this.tireGripCurve(slipAngle, v.peakSlipAngle, v.slideSlipAngle, v.gripCurve);

        let effectiveFrontGrip = v.frontGrip * frontGripMult * v.frontLoad * 2;
        let effectiveRearGrip = v.rearGrip * rearGripMult * rearLoad * 2;

        v.isDrifting = false;
        const isBraking = input.brake > 0 && forwardSpeed > 5;

        if (input.handbrake && absSpeed > 8) {
            effectiveRearGrip *= v.handbrakeRearGrip;
            v.isDrifting = true;
        }
        if (absSlip > v.peakSlipAngle * 1.5) v.isDrifting = true;

        const avgGrip = (effectiveFrontGrip + effectiveRearGrip) * 0.5;
        const currentGrip = clamp(avgGrip, 0.15, 1.0);

        if (absSpeed > 0.3) {
            let turnRate = (forwardSpeed * Math.tan(v.steeringAngle)) / body.wheelBase;
            turnRate *= clamp(effectiveFrontGrip, 0.3, 1.0);
            body.heading += turnRate * dt;
        }

        carForward = body.getForwardDir();
        carRight = body.getRightDir();

        body.linearVelocity.addScaled(carForward, thrust * dt);
        body.linearVelocity.scale(input.handbrake ? v.handbrakeDecay : v.rollingFriction);

        if (totalSpeed > 5) {
            const dragForce = v.airDrag * totalSpeed * totalSpeed * v.damage.getDragPenalty();
            const dragDecel = Math.min(dragForce * dt, totalSpeed * 0.5);
            const velNorm = body.linearVelocity.clone().normalize();
            body.linearVelocity.addScaled(velNorm, -dragDecel);
        }

        const maxCurrentSpeed = v.isNitroActive ? v.maxSpeed * 1.3 : v.maxSpeed;
        if (body.linearVelocity.length() > maxCurrentSpeed) {
            body.linearVelocity.setLength(maxCurrentSpeed);
        }

        forwardSpeed = body.linearVelocity.dot(carForward);
        lateralSpeed = body.linearVelocity.dot(carRight);

        let lateralReduction = currentGrip * v.lateralStiffness * dt;
        lateralReduction = clamp(lateralReduction, 0, 0.85);
        const correctedLateral = lateralSpeed * (1.0 - lateralReduction);

        body.linearVelocity.copy(
            carForward.clone().scale(forwardSpeed).add(carRight.clone().scale(correctedLateral))
        );

        const sideDrag = v.damage.getSideDragBias();
        if (Math.abs(sideDrag) > 0.001) {
            body.linearVelocity.addScaled(carRight, sideDrag * totalSpeed);
        }

        const groundHeight = this.collision.getTerrainHeight(body.position.x, body.position.z);
        const groundLevel = groundHeight + v.wheels[0].radius;
        body.position.y = groundLevel;
        body.linearVelocity.y = 0;

        const nextPos = body.position.clone().addScaled(body.linearVelocity, dt);
        const contacts = this.collision.testCollision(nextPos);

        if (contacts.length > 0) {
            for (const contact of contacts) {
                const velIntoWall = body.linearVelocity.dot(contact.normal);
                if (velIntoWall < 0) {
                    body.linearVelocity.addScaled(contact.normal, -velIntoWall * 1.1);
                    const impactLoss = clamp(1.0 - Math.abs(velIntoWall) * 0.005, 0.7, 0.95);
                    body.linearVelocity.scale(impactLoss);
                    body.position.addScaled(contact.normal, 0.5);

                    v.damage.applyImpact(
                        Math.abs(velIntoWall),
                        contact.normal.x > 0.5 ? 1 : contact.normal.x < -0.5 ? -1 : 0,
                        contact.normal.z > 0.5 ? 1 : contact.normal.z < -0.5 ? -1 : 0
                    );
                }
            }
        } else {
            body.position.copy(nextPos);
        }

        const longitudinalG = thrust * 0.0004;
        const yawRate = absSpeed > 0.3 ? (forwardSpeed * Math.tan(v.steeringAngle)) / body.wheelBase : 0;
        const lateralG = yawRate * absSpeed * 0.00025;

        const pitchTarget = clamp(-longitudinalG, -v.maxPitch, v.maxPitch);
        const rollTarget = clamp(-lateralG, -v.maxRoll, v.maxRoll);

        v.suspensionPitchVel += (pitchTarget - v.suspensionPitch) * v.suspensionStiffness * dt;
        v.suspensionRollVel += (rollTarget - v.suspensionRoll) * v.suspensionStiffness * dt;
        v.suspensionPitchVel *= v.suspensionDamping;
        v.suspensionRollVel *= v.suspensionDamping;
        v.suspensionPitch += v.suspensionPitchVel;
        v.suspensionRoll += v.suspensionRollVel;

        v.driftAngle = absSpeed > 2 ? Math.atan2(lateralSpeed, Math.abs(forwardSpeed)) : 0;

        const wheelSpinBase = forwardSpeed / v.wheels[0].radius;
        for (const w of v.wheels) {
            w.spinSpeed = wheelSpinBase;
            w.spinAngle += w.spinSpeed * dt;
            w.temperature = lerp(w.temperature, 40 + absSlip * 200, dt * 0.5);
        }

        this.telemetry = {
            speed: absSpeed * 3.6,
            forwardSpeed: forwardSpeed * 3.6,
            rpm: v.engine.rpm,
            gear: v.transmission.displayGear,
            gearIndex: v.transmission.currentGear,
            nitro: v.nitro,
            maxNitro: v.maxNitro,
            isDrifting: v.isDrifting,
            isNitroActive: v.isNitroActive,
            steerAngle: v.steeringAngle,
            driftAngle: v.driftAngle,
            damage: { ...v.damage.zones },
            totalDamage: v.damage.getTotalDamage01(),
            absActive: v.assists.absActive,
            tcActive: v.assists.tcActive,
            scActive: v.assists.scActive,
            suspensionPitch: v.suspensionPitch,
            suspensionRoll: v.suspensionRoll,
            wheels: v.wheels.map(w => ({
                slipAngle: w.slipAngle,
                slipRatio: w.slipRatio,
                load: w.load,
                temp: w.temperature,
                wear: w.wear,
                grounded: true,
                compression: w.suspension.getCompression01(),
                bottomedOut: w.suspension.bottomedOut,
                spinAngle: w.spinAngle,
                lateralForce: 0,
                longitudinalForce: 0,
            })),
            tireTemp: v.wheels.reduce((sum, w) => sum + w.temperature, 0) / 4,
            tireWear: v.wheels.reduce((sum, w) => sum + w.wear, 0) / 4,
        };
    }

    getAvgDrivenWheelSpeed(v) {
        let sum = 0;
        let count = 0;
        for (const w of v.wheels) {
            if (w.isDriven) {
                sum += w.spinSpeed;
                count++;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    reset() {
        this.accumulator = 0;
        this.tickCount = 0;
        this.vehicles.forEach(v => v.reset(0, 0.33, 0));
        this.weather.reset();
        this.collision.reset();
        this.telemetry = null;
    }
}
