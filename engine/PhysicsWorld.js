import { Vec3, clamp } from './MathUtils.js';
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
        this.nitroBoostForce = config.nitroBoostForce || 6000;
        this.isNitroActive = false;

        this.isDrifting = false;
        this.driftAngle = 0;
    }

    get position() { return this.body.position; }
    get heading() { return this.body.heading; }
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

    updateVehicle(v, dt) {
        const body = v.body;
        const input = v.input;
        const fwd = body.getForwardDir();
        const right = body.getRightDir();
        const forwardSpeed = body.getForwardSpeed();
        const absSpeed = Math.abs(forwardSpeed);
        const speed = body.getSpeed();

        const steerAngle = v.steering.update(input.steer, forwardSpeed, dt);
        const ackermann = v.steering.getAckermannAngles();

        const alignDrift = v.damage.getAlignmentDrift();
        v.wheels[0].steerAngle = ackermann.left + alignDrift;
        v.wheels[1].steerAngle = ackermann.right + alignDrift;
        v.wheels[2].steerAngle = 0;
        v.wheels[3].steerAngle = 0;

        const steeringPenalty = v.damage.getSteeringPenalty();
        v.wheels[0].steerAngle *= steeringPenalty;
        v.wheels[1].steerAngle *= steeringPenalty;

        v.isNitroActive = input.nitro && v.nitro > 0 && input.throttle > 0;
        if (v.isNitroActive) {
            v.nitro = Math.max(0, v.nitro - v.nitroDrain * dt);
        } else {
            v.nitro = Math.min(v.maxNitro, v.nitro + v.nitroRegen * dt);
        }

        let throttle = clamp(input.throttle, 0, 1);
        throttle = v.assists.updateTC(v.wheels, throttle);
        throttle *= v.damage.getPowerPenalty();

        const avgDrivenWheelSpeed = this.getAvgDrivenWheelSpeed(v);
        const wheelFeedbackRPM = v.transmission.getWheelRPMToEngineRPM(
            Math.abs(avgDrivenWheelSpeed) * 60 / (2 * Math.PI)
        );

        const engineTorque = v.engine.update(wheelFeedbackRPM, throttle, dt);
        v.transmission.update(v.engine.rpm, forwardSpeed, dt);

        const wheelTorque = v.transmission.getWheelTorque(engineTorque);
        const torqueSplit = v.transmission.getTorqueSplit();

        let brakeTorque = clamp(input.brake, 0, 1) * 3000;
        brakeTorque = v.assists.updateABS(v.wheels, brakeTorque, dt);

        if (input.handbrake) {
            v.wheels[2].locked = true;
            v.wheels[3].locked = true;
        } else {
            v.wheels[2].locked = false;
            v.wheels[3].locked = false;
        }

        body.applyForce(new Vec3(0, -this.gravity * body.mass, 0));

        const dragForce = v.aero.computeDrag(body.linearVelocity, fwd);
        body.applyForce(dragForce.scale(v.damage.getDragPenalty()));

        const downforce = v.aero.computeDownforce(speed);

        const windForce = this.weather.getWindForce(v.aero.frontalArea);
        if (windForce.lengthSq() > 0) body.applyForce(windForce);

        const totalWeight = body.mass * this.gravity;
        const accelG = forwardSpeed > 0.5 ? (throttle - input.brake) * 0.3 : 0;
        const weightTransfer = accelG * body.mass * 0.1;
        const frontStaticLoad = totalWeight * 0.48;
        const rearStaticLoad = totalWeight * 0.52;

        let frontLeftLoad = (frontStaticLoad - weightTransfer) * 0.5 + downforce.front * 0.5;
        let frontRightLoad = (frontStaticLoad - weightTransfer) * 0.5 + downforce.front * 0.5;
        let rearLeftLoad = (rearStaticLoad + weightTransfer) * 0.5 + downforce.rear * 0.5;
        let rearRightLoad = (rearStaticLoad + weightTransfer) * 0.5 + downforce.rear * 0.5;

        const yawRate = body.angularVelocity.y;
        const lateralAccel = yawRate * absSpeed;
        const lateralTransfer = lateralAccel * body.mass * 0.05;

        frontLeftLoad += lateralTransfer;
        frontRightLoad -= lateralTransfer;
        rearLeftLoad += lateralTransfer;
        rearRightLoad -= lateralTransfer;

        const frontARB = v.frontARB.compute(
            v.wheels[0].suspension.compression,
            v.wheels[1].suspension.compression
        );
        frontLeftLoad += frontARB.leftForce;
        frontRightLoad += frontARB.rightForce;

        const rearARB = v.rearARB.compute(
            v.wheels[2].suspension.compression,
            v.wheels[3].suspension.compression
        );
        rearLeftLoad += rearARB.leftForce;
        rearRightLoad += rearARB.rightForce;

        const loads = [
            Math.max(frontLeftLoad, 0),
            Math.max(frontRightLoad, 0),
            Math.max(rearLeftLoad, 0),
            Math.max(rearRightLoad, 0),
        ];

        let totalLat = 0;
        let totalLong = 0;
        let totalYawTorque = 0;
        v.isDrifting = false;

        for (let i = 0; i < 4; i++) {
            const wheel = v.wheels[i];
            const worldPos = body.localToWorld(wheel.localPosition);

            wheel.surface = this.weather.getSurfaceModifier(worldPos.x, worldPos.z);

            const wheelHeading = body.heading + wheel.steerAngle;
            const wheelFwd = new Vec3(Math.sin(wheelHeading), 0, Math.cos(wheelHeading));
            const wheelRight = new Vec3(Math.cos(wheelHeading), 0, -Math.sin(wheelHeading));

            const wFwdSpeed = body.linearVelocity.dot(wheelFwd);
            const wLatSpeed = body.linearVelocity.dot(wheelRight);

            const driveTorqueForWheel = wheel.isDriven
                ? wheelTorque * (i < 2 ? torqueSplit.front : torqueSplit.rear) * 0.5
                : 0;

            wheel.update(wFwdSpeed, wLatSpeed, driveTorqueForWheel, brakeTorque * 0.25, loads[i], dt);

            const latForce = -wheel.lateralForce;
            const longForce = wheel.longitudinalForce;

            const forceWorld = new Vec3(
                wheelFwd.x * longForce + wheelRight.x * latForce,
                0,
                wheelFwd.z * longForce + wheelRight.z * latForce
            );

            body.applyForceAtPoint(forceWorld, worldPos);

            if (wheel.isDrifting()) v.isDrifting = true;
        }

        if (v.isNitroActive) {
            body.applyForce(fwd.clone().scale(v.nitroBoostForce));
        }

        const sideDrag = v.damage.getSideDragBias();
        if (Math.abs(sideDrag) > 0.001) {
            body.applyForce(right.clone().scale(sideDrag * speed * body.mass));
        }

        body.integrate(dt);

        const contacts = this.collision.testCollision(body.position);
        for (const contact of contacts) {
            const velIntoWall = body.linearVelocity.dot(contact.normal);
            if (velIntoWall < 0) {
                contact.impactSpeed = Math.abs(velIntoWall);

                body.linearVelocity.addScaled(contact.normal, -velIntoWall * 1.2);

                const impactLoss = clamp(1.0 - Math.abs(velIntoWall) * 0.004, 0.6, 0.95);
                body.linearVelocity.scale(impactLoss);

                body.position.addScaled(contact.normal, contact.penetration + 0.1);

                const localNormal = body.worldToLocal(
                    body.position.clone().add(contact.normal)
                ).sub(body.worldToLocal(body.position.clone()));

                v.damage.applyImpact(
                    Math.abs(velIntoWall),
                    localNormal.x,
                    localNormal.z
                );

                body.angularVelocity.y *= 0.85;
            }
        }

        v.driftAngle = absSpeed > 2
            ? Math.atan2(body.getLateralSpeed(), Math.abs(forwardSpeed))
            : 0;

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
            steerAngle: steerAngle,
            driftAngle: v.driftAngle,
            damage: { ...v.damage.zones },
            totalDamage: v.damage.getTotalDamage01(),
            absActive: v.assists.absActive,
            tcActive: v.assists.tcActive,
            scActive: v.assists.scActive,
            wheels: v.wheels.map(w => ({
                slipAngle: w.slipAngle,
                slipRatio: w.slipRatio,
                load: w.load,
                temp: w.temperature,
                wear: w.wear,
                grounded: w.grounded,
                compression: w.suspension.getCompression01(),
                bottomedOut: w.suspension.bottomedOut,
                spinAngle: w.spinAngle,
                lateralForce: w.lateralForce,
                longitudinalForce: w.longitudinalForce,
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
        this.vehicles.forEach(v => v.reset(0, 0.5, 0));
        this.weather.reset();
        this.collision.reset();
        this.telemetry = null;
    }
}
