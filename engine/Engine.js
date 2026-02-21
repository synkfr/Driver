import { clamp, lerpTable } from './MathUtils.js';

export class EngineUnit {
    constructor(config = {}) {
        this.torqueCurve = config.torqueCurve || {
            keys: [800, 1500, 2500, 3500, 4500, 5500, 6500, 7500, 8000],
            values: [120, 200, 310, 380, 420, 400, 360, 300, 250],
        };

        this.idleRPM = config.idleRPM || 800;
        this.redlineRPM = config.redlineRPM || 7800;
        this.maxRPM = config.maxRPM || 8200;
        this.revLimiterRPM = config.revLimiterRPM || 7900;

        this.engineBrakeTorque = config.engineBrakeTorque || 40;
        this.momentOfInertia = config.momentOfInertia || 0.15;
        this.frictionTorque = config.frictionTorque || 10;

        this.rpm = this.idleRPM;
        this.throttle = 0;
        this.revLimiterActive = false;
    }

    getTorque(rpm, throttle) {
        if (this.revLimiterActive && rpm > this.revLimiterRPM) {
            return 0;
        }
        if (rpm >= this.revLimiterRPM) {
            this.revLimiterActive = true;
        }
        if (rpm < this.revLimiterRPM - 300) {
            this.revLimiterActive = false;
        }

        const maxTorqueAtRPM = lerpTable(this.torqueCurve, rpm);
        const driveTorque = maxTorqueAtRPM * clamp(throttle, 0, 1);

        return driveTorque;
    }

    getEngineBraking(rpm, throttle, wheelSpeed) {
        if (throttle > 0.05) return 0;
        if (Math.abs(wheelSpeed) < 0.5) return 0;
        const rpmFactor = clamp((rpm - this.idleRPM) / (this.redlineRPM - this.idleRPM), 0, 1);
        return this.engineBrakeTorque * (0.3 + rpmFactor * 0.7) * Math.sign(wheelSpeed);
    }

    update(wheelFeedbackRPM, throttle, dt) {
        this.throttle = clamp(throttle, 0, 1);

        const targetRPM = Math.max(wheelFeedbackRPM, this.idleRPM);
        const rpmBlend = 0.1 + this.throttle * 0.15;
        this.rpm = this.rpm + (targetRPM - this.rpm) * clamp(rpmBlend * dt * 60, 0, 1);

        this.rpm = clamp(this.rpm, this.idleRPM, this.maxRPM);

        return this.getTorque(this.rpm, this.throttle);
    }

    getRPMNormalized() {
        return clamp((this.rpm - this.idleRPM) / (this.redlineRPM - this.idleRPM), 0, 1);
    }

    reset() {
        this.rpm = this.idleRPM;
        this.throttle = 0;
        this.revLimiterActive = false;
    }
}
