import { Vec3, clamp } from './MathUtils.js';
import { SuspensionUnit } from './Suspension.js';
import {
    computeSlipAngle, computeSlipRatio,
    computeLateralForce, computeLongitudinalForce,
    frictionCircle, updateTireTemperature, updateTireWear
} from './TireModel.js';
import { SURFACES } from './Surface.js';

export class Wheel {
    constructor(config = {}) {
        this.localPosition = new Vec3(
            config.x || 0,
            config.y || 0,
            config.z || 0
        );

        this.radius = config.radius || 0.33;
        this.width = config.width || 0.225;
        this.mass = config.mass || 15;
        this.inertia = 0.5 * this.mass * this.radius * this.radius;

        this.isDriven = config.isDriven !== undefined ? config.isDriven : false;
        this.isSteered = config.isSteered !== undefined ? config.isSteered : false;

        this.steerAngle = 0;
        this.spinSpeed = 0;
        this.spinAngle = 0;

        this.slipAngle = 0;
        this.slipRatio = 0;
        this.lateralForce = 0;
        this.longitudinalForce = 0;

        this.load = this.mass * 9.81;
        this.grounded = true;
        this.surface = SURFACES.ASPHALT;

        this.temperature = 40;
        this.wear = 0;

        this.locked = false;

        this.suspension = new SuspensionUnit({
            springRate: config.springRate || 35000,
            damping: config.damping || 4500,
            maxTravel: config.maxTravel || 0.15,
        });

        this.visualYOffset = 0;
    }

    update(forwardVel, lateralVel, driveTorque, brakeTorque, load, dt) {
        this.load = Math.max(load, 0);

        if (this.load < 10) {
            this.grounded = false;
            this.lateralForce = 0;
            this.longitudinalForce = 0;
            this.spinSpeed *= 0.99;
            this.spinAngle += this.spinSpeed * dt;
            return;
        }
        this.grounded = true;

        this.slipAngle = computeSlipAngle(lateralVel, forwardVel);
        this.slipRatio = computeSlipRatio(this.spinSpeed, this.radius, forwardVel);

        let rawLatForce = computeLateralForce(
            this.slipAngle, this.load, this.surface, this.temperature, this.wear
        );
        let rawLongForce = computeLongitudinalForce(
            this.slipRatio, this.load, this.surface, this.temperature, this.wear
        );

        const maxGrip = this.load * (this.surface?.friction || 1.0);
        const combined = frictionCircle(rawLatForce, rawLongForce, maxGrip);
        this.lateralForce = combined.lat;
        this.longitudinalForce = combined.long;

        let netTorque = 0;
        if (this.isDriven) netTorque += driveTorque;

        if (this.locked) {
            const lockDecel = forwardVel * this.mass * 2;
            netTorque -= lockDecel * this.radius;
            this.spinSpeed *= 0.9;
        } else {
            netTorque -= brakeTorque * Math.sign(this.spinSpeed);
        }

        netTorque -= this.longitudinalForce * this.radius;

        const spinAccel = netTorque / this.inertia;
        this.spinSpeed += spinAccel * dt;

        if (Math.abs(brakeTorque) > 0 && Math.abs(this.spinSpeed) < 1) {
            this.spinSpeed *= 0.95;
        }

        this.spinAngle += this.spinSpeed * dt;

        const slipMag = Math.sqrt(this.slipAngle * this.slipAngle + this.slipRatio * this.slipRatio);
        this.temperature = updateTireTemperature(this.temperature, slipMag, this.load, Math.abs(forwardVel), dt);
        this.wear = updateTireWear(this.wear, slipMag, this.load, dt);

        this.suspension.update(this.load, dt);
        this.visualYOffset = -this.suspension.compression;
    }

    isDrifting() {
        return Math.abs(this.slipAngle) > 0.08 && this.grounded;
    }

    isSaturated() {
        const maxGrip = this.load * (this.surface?.friction || 1.0);
        const total = Math.sqrt(this.lateralForce ** 2 + this.longitudinalForce ** 2);
        return total > maxGrip * 0.9;
    }

    reset() {
        this.spinSpeed = 0;
        this.spinAngle = 0;
        this.slipAngle = 0;
        this.slipRatio = 0;
        this.lateralForce = 0;
        this.longitudinalForce = 0;
        this.load = this.mass * 9.81;
        this.temperature = 40;
        this.wear = 0;
        this.locked = false;
        this.suspension.reset();
    }
}
