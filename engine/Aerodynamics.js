import { Vec3 } from './MathUtils.js';

const AIR_DENSITY = 1.225;

export class Aerodynamics {
    constructor(config = {}) {
        this.dragCoefficient = config.dragCoefficient || 0.32;
        this.frontalArea = config.frontalArea || 2.2;
        this.liftCoefficient = config.liftCoefficient || -0.45;
        this.downforceAreaFront = config.downforceAreaFront || 0.3;
        this.downforceAreaRear = config.downforceAreaRear || 0.5;

        this.slipstreamConeAngle = config.slipstreamConeAngle || 0.35;
        this.slipstreamMaxDistance = config.slipstreamMaxDistance || 30;
        this.slipstreamReduction = config.slipstreamReduction || 0.40;
        this.inSlipstream = false;
    }

    computeDrag(velocity, headingDir) {
        const speed = velocity.length();
        if (speed < 0.5) return Vec3.ZERO();

        const dragMagnitude = 0.5 * AIR_DENSITY * this.dragCoefficient * this.frontalArea * speed * speed;

        let slipstreamFactor = this.inSlipstream ? (1.0 - this.slipstreamReduction) : 1.0;

        const dir = velocity.clone().normalize().negate();
        return dir.scale(dragMagnitude * slipstreamFactor);
    }

    computeDownforce(speed) {
        const speedSq = speed * speed;
        const frontForce = 0.5 * AIR_DENSITY * Math.abs(this.liftCoefficient) * this.downforceAreaFront * speedSq;
        const rearForce = 0.5 * AIR_DENSITY * Math.abs(this.liftCoefficient) * this.downforceAreaRear * speedSq;
        return { front: frontForce, rear: rearForce };
    }

    checkSlipstream(myPos, myForward, otherVehicles) {
        this.inSlipstream = false;

        for (const other of otherVehicles) {
            const toOther = other.position.clone().sub(myPos);
            const dist = toOther.length();

            if (dist < 3 || dist > this.slipstreamMaxDistance) continue;

            toOther.normalize();
            const dot = toOther.dot(myForward);

            if (dot > Math.cos(this.slipstreamConeAngle)) {
                this.inSlipstream = true;
                return;
            }
        }
    }

    reset() {
        this.inSlipstream = false;
    }
}
