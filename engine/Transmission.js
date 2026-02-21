import { clamp } from './MathUtils.js';

export class Transmission {
    constructor(config = {}) {
        this.gearRatios = config.gearRatios || [-3.2, 0, 3.8, 2.5, 1.8, 1.3, 1.0, 0.8];
        this.finalDrive = config.finalDrive || 3.42;
        this.efficiency = config.efficiency || 0.85;

        this.currentGear = 2;
        this.isAutomatic = config.isAutomatic !== undefined ? config.isAutomatic : true;

        this.shiftUpRPM = config.shiftUpRPM || 7200;
        this.shiftDownRPM = config.shiftDownRPM || 2800;
        this.shiftCooldown = 0;
        this.shiftDuration = config.shiftDuration || 0.15;

        this.clutchEngaged = 1.0;

        this.drivetrain = config.drivetrain || 'RWD';
        this.frontBias = config.frontBias || 0.4;
    }

    get gearCount() { return this.gearRatios.length; }
    get isReverse() { return this.currentGear === 0; }
    get isNeutral() { return this.currentGear === 1; }
    get displayGear() {
        if (this.currentGear === 0) return 'R';
        if (this.currentGear === 1) return 'N';
        return this.currentGear - 1;
    }

    getCurrentRatio() {
        return this.gearRatios[this.currentGear] * this.finalDrive;
    }

    getWheelTorque(engineTorque) {
        if (this.shiftCooldown > 0) return 0;
        const ratio = this.getCurrentRatio();
        return engineTorque * ratio * this.efficiency * this.clutchEngaged;
    }

    getWheelRPMToEngineRPM(wheelRPM) {
        const ratio = Math.abs(this.getCurrentRatio());
        if (ratio < 0.01) return 800;
        return wheelRPM * ratio;
    }

    update(engineRPM, speed, dt) {
        if (this.shiftCooldown > 0) {
            this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
            this.clutchEngaged = clamp(1.0 - (this.shiftCooldown / this.shiftDuration), 0, 1);
        } else {
            this.clutchEngaged = 1.0;
        }

        if (!this.isAutomatic) return;

        const maxForwardGear = this.gearRatios.length - 1;

        if (this.currentGear >= 2 && this.currentGear < maxForwardGear) {
            if (engineRPM > this.shiftUpRPM && this.shiftCooldown <= 0) {
                this.shift(this.currentGear + 1);
            }
        }

        if (this.currentGear > 2) {
            if (engineRPM < this.shiftDownRPM && this.shiftCooldown <= 0) {
                this.shift(this.currentGear - 1);
            }
        }

        if (this.currentGear < 2 && speed > 1) {
            this.shift(2);
        }
    }

    shift(gear) {
        gear = clamp(gear, 0, this.gearRatios.length - 1);
        if (gear === this.currentGear) return;
        this.currentGear = gear;
        this.shiftCooldown = this.shiftDuration;
        this.clutchEngaged = 0;
    }

    shiftUp() {
        if (this.currentGear < this.gearRatios.length - 1 && this.shiftCooldown <= 0) {
            this.shift(this.currentGear + 1);
        }
    }

    shiftDown() {
        if (this.currentGear > 0 && this.shiftCooldown <= 0) {
            this.shift(this.currentGear - 1);
        }
    }

    getTorqueSplit() {
        switch (this.drivetrain) {
            case 'FWD': return { front: 1.0, rear: 0.0 };
            case 'AWD': return { front: this.frontBias, rear: 1.0 - this.frontBias };
            case 'RWD':
            default: return { front: 0.0, rear: 1.0 };
        }
    }

    reset() {
        this.currentGear = 2;
        this.shiftCooldown = 0;
        this.clutchEngaged = 1.0;
    }
}
