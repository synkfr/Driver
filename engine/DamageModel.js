import { clamp } from './MathUtils.js';

export class DamageModel {
    constructor(config = {}) {
        this.zones = {
            front: 0,
            rear: 0,
            left: 0,
            right: 0,
        };

        this.maxDamage = config.maxDamage || 100;
        this.damageThreshold = config.damageThreshold || 5;
        this.damageScale = config.damageScale || 0.15;
        this.enabled = config.enabled !== undefined ? config.enabled : true;
    }

    applyImpact(impactForce, normalX, normalZ) {
        if (!this.enabled) return;
        if (impactForce < this.damageThreshold) return;

        const dmg = (impactForce - this.damageThreshold) * this.damageScale;

        if (normalZ > 0.5) this.zones.front = clamp(this.zones.front + dmg, 0, this.maxDamage);
        if (normalZ < -0.5) this.zones.rear = clamp(this.zones.rear + dmg, 0, this.maxDamage);
        if (normalX > 0.5) this.zones.left = clamp(this.zones.left + dmg, 0, this.maxDamage);
        if (normalX < -0.5) this.zones.right = clamp(this.zones.right + dmg, 0, this.maxDamage);
    }

    getSteeringPenalty() {
        const frontDmg = this.zones.front / this.maxDamage;
        return 1.0 - frontDmg * 0.4;
    }

    getAlignmentDrift() {
        const leftDmg = this.zones.left / this.maxDamage;
        const rightDmg = this.zones.right / this.maxDamage;
        return (rightDmg - leftDmg) * 0.02;
    }

    getPowerPenalty() {
        const rearDmg = this.zones.rear / this.maxDamage;
        return 1.0 - rearDmg * 0.35;
    }

    getDragPenalty() {
        const total = (this.zones.front + this.zones.rear + this.zones.left + this.zones.right) / (this.maxDamage * 4);
        return 1.0 + total * 0.3;
    }

    getSideDragBias() {
        const leftDmg = this.zones.left / this.maxDamage;
        const rightDmg = this.zones.right / this.maxDamage;
        return (leftDmg - rightDmg) * 0.1;
    }

    getTotalDamage01() {
        return (this.zones.front + this.zones.rear + this.zones.left + this.zones.right) / (this.maxDamage * 4);
    }

    repair() {
        this.zones.front = 0;
        this.zones.rear = 0;
        this.zones.left = 0;
        this.zones.right = 0;
    }

    reset() {
        this.repair();
    }
}
