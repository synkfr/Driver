import { clamp } from './MathUtils.js';

const BUMP_STOP_STIFFNESS = 50000;
const BUMP_STOP_ZONE = 0.02;

export class SuspensionUnit {
    constructor(config = {}) {
        this.springRate = config.springRate || 35000;
        this.damping = config.damping || 4500;
        this.maxTravel = config.maxTravel || 0.15;
        this.restLength = config.restLength || 0.3;

        this.compression = 0;
        this.velocity = 0;
        this.force = 0;
        this.bottomedOut = false;
    }

    update(wheelLoad, dt) {
        const targetCompression = clamp(
            (wheelLoad / this.springRate) * 0.05,
            -this.maxTravel,
            this.maxTravel
        );

        const prevCompression = this.compression;
        this.velocity = (targetCompression - prevCompression) / Math.max(dt, 0.0001);
        this.compression = targetCompression;

        let springForce = this.springRate * this.compression;
        let damperForce = this.damping * this.velocity;

        const travel = Math.abs(this.compression);
        const travelLimit = this.maxTravel - BUMP_STOP_ZONE;
        if (travel > travelLimit) {
            const penetration = travel - travelLimit;
            const bumpForce = BUMP_STOP_STIFFNESS * penetration * penetration;
            springForce += bumpForce * Math.sign(this.compression);
        }

        this.bottomedOut = travel >= this.maxTravel * 0.95;
        this.force = springForce + damperForce;

        return this.force;
    }

    getCompression01() {
        return clamp(Math.abs(this.compression) / this.maxTravel, 0, 1);
    }

    reset() {
        this.compression = 0;
        this.velocity = 0;
        this.force = 0;
        this.bottomedOut = false;
    }
}

export class AntiRollBar {
    constructor(stiffness = 12000) {
        this.stiffness = stiffness;
    }

    compute(leftCompression, rightCompression) {
        const diff = leftCompression - rightCompression;
        const force = this.stiffness * diff;
        return { leftForce: -force, rightForce: force };
    }
}
