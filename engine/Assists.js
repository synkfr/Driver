import { clamp } from './MathUtils.js';

export class Assists {
    constructor(config = {}) {
        this.absEnabled = config.absEnabled !== undefined ? config.absEnabled : true;
        this.tcEnabled = config.tcEnabled !== undefined ? config.tcEnabled : true;
        this.scEnabled = config.scEnabled !== undefined ? config.scEnabled : true;

        this.absSlipThreshold = config.absSlipThreshold || 0.15;
        this.absPulseRate = config.absPulseRate || 15;
        this.absActive = false;

        this.tcSlipThreshold = config.tcSlipThreshold || 0.10;
        this.tcReductionFactor = config.tcReductionFactor || 0.6;
        this.tcActive = false;

        this.scYawThreshold = config.scYawThreshold || 0.15;
        this.scBrakeForce = config.scBrakeForce || 800;
        this.scActive = false;

        this._absTimer = 0;
    }

    updateABS(wheels, brakeTorque, dt) {
        if (!this.absEnabled || brakeTorque <= 0) {
            this.absActive = false;
            return brakeTorque;
        }

        let anyLocked = false;
        for (const w of wheels) {
            if (Math.abs(w.slipRatio) > this.absSlipThreshold && w.grounded) {
                anyLocked = true;
                break;
            }
        }

        if (!anyLocked) {
            this.absActive = false;
            return brakeTorque;
        }

        this.absActive = true;
        this._absTimer += dt;
        const pulse = Math.sin(this._absTimer * this.absPulseRate * Math.PI * 2);
        return pulse > 0 ? brakeTorque : brakeTorque * 0.1;
    }

    updateTC(wheels, throttle) {
        if (!this.tcEnabled || throttle <= 0) {
            this.tcActive = false;
            return throttle;
        }

        let anySpinning = false;
        for (const w of wheels) {
            if (w.isDriven && w.slipRatio > this.tcSlipThreshold && w.grounded) {
                anySpinning = true;
                break;
            }
        }

        if (!anySpinning) {
            this.tcActive = false;
            return throttle;
        }

        this.tcActive = true;
        return throttle * this.tcReductionFactor;
    }

    updateSC(yawRate, targetYawRate, wheels, forwardDir, speed) {
        if (!this.scEnabled || speed < 5) {
            this.scActive = false;
            return null;
        }

        const yawError = yawRate - targetYawRate;

        if (Math.abs(yawError) < this.scYawThreshold) {
            this.scActive = false;
            return null;
        }

        this.scActive = true;

        const corrections = { fl: 0, fr: 0, rl: 0, rr: 0 };
        const force = Math.abs(yawError) * this.scBrakeForce;

        if (yawError > 0) {
            corrections.fl = force;
            corrections.rl = force * 0.5;
        } else {
            corrections.fr = force;
            corrections.rr = force * 0.5;
        }

        return corrections;
    }

    reset() {
        this.absActive = false;
        this.tcActive = false;
        this.scActive = false;
        this._absTimer = 0;
    }
}
