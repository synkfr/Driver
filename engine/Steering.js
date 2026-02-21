import { clamp } from './MathUtils.js';

export class Steering {
    constructor(config = {}) {
        this.maxAngle = config.maxAngle || 0.55;
        this.speedReductionFactor = config.speedReductionFactor || 0.004;
        this.minSpeedAngle = config.minSpeedAngle || 0.12;
        this.returnSpeed = config.returnSpeed || 6.0;
        this.turnSpeed = config.turnSpeed || 4.0;
        this.wheelBase = config.wheelBase || 2.6;
        this.trackWidth = config.trackWidth || 1.6;

        this.currentAngle = 0;
    }

    update(steerInput, speed, dt) {
        const absSpeed = Math.abs(speed);
        const speedFactor = 1.0 / (1.0 + absSpeed * this.speedReductionFactor);
        const effectiveMax = Math.max(this.maxAngle * speedFactor, this.minSpeedAngle);

        const targetAngle = clamp(steerInput, -1, 1) * effectiveMax;

        const rate = steerInput !== 0 ? this.turnSpeed : this.returnSpeed;
        const blend = clamp(rate * dt, 0, 1);
        this.currentAngle += (targetAngle - this.currentAngle) * blend;

        return this.currentAngle;
    }

    getAckermannAngles() {
        const angle = this.currentAngle;
        if (Math.abs(angle) < 0.001) return { left: 0, right: 0 };

        const turnRadius = this.wheelBase / Math.tan(Math.abs(angle));
        const innerRadius = turnRadius - this.trackWidth * 0.5;
        const outerRadius = turnRadius + this.trackWidth * 0.5;

        const innerAngle = Math.atan(this.wheelBase / innerRadius);
        const outerAngle = Math.atan(this.wheelBase / outerRadius);

        if (angle > 0) {
            return { left: innerAngle, right: outerAngle };
        } else {
            return { left: -outerAngle, right: -innerAngle };
        }
    }

    reset() {
        this.currentAngle = 0;
    }
}
