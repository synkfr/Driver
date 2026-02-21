import { Vec3, Quat, clamp } from './MathUtils.js';

export class VehicleBody {
    constructor(config = {}) {
        this.mass = config.mass || 1400;
        this.inverseMass = 1.0 / this.mass;

        this.inertia = new Vec3(
            config.inertiaX || 800,
            config.inertiaY || 1600,
            config.inertiaZ || 600
        );
        this.inverseInertia = new Vec3(
            1.0 / this.inertia.x,
            1.0 / this.inertia.y,
            1.0 / this.inertia.z
        );

        this.centerOfMass = new Vec3(
            config.comX || 0,
            config.comY || 0.35,
            config.comZ || -0.1
        );

        this.position = new Vec3(config.x || 0, config.y || 0.5, config.z || 0);
        this.rotation = new Quat();
        this.heading = 0;

        this.linearVelocity = Vec3.ZERO();
        this.angularVelocity = Vec3.ZERO();

        this.forceAccum = Vec3.ZERO();
        this.torqueAccum = Vec3.ZERO();

        this.wheelBase = config.wheelBase || 2.6;
        this.trackWidth = config.trackWidth || 1.6;

        this.grounded = true;
    }

    applyForce(force) {
        this.forceAccum.add(force);
    }

    applyForceAtPoint(force, worldPoint) {
        this.forceAccum.add(force);
        const r = worldPoint.clone().sub(this.getWorldCOM());
        this.torqueAccum.add(r.cross(force));
    }

    applyTorque(torque) {
        this.torqueAccum.add(torque);
    }

    getWorldCOM() {
        const localCOM = this.centerOfMass.clone();
        localCOM.rotateY(this.heading);
        return this.position.clone().add(localCOM);
    }

    getForwardDir() {
        return new Vec3(Math.sin(this.heading), 0, Math.cos(this.heading));
    }

    getRightDir() {
        return new Vec3(Math.cos(this.heading), 0, -Math.sin(this.heading));
    }

    getUpDir() {
        return new Vec3(0, 1, 0);
    }

    getForwardSpeed() {
        return this.linearVelocity.dot(this.getForwardDir());
    }

    getLateralSpeed() {
        return this.linearVelocity.dot(this.getRightDir());
    }

    getSpeed() {
        return this.linearVelocity.length();
    }

    getSpeedKmh() {
        return this.getSpeed() * 3.6;
    }

    localToWorld(localPoint) {
        const p = localPoint.clone();
        p.rotateY(this.heading);
        return p.add(this.position);
    }

    worldToLocal(worldPoint) {
        const p = worldPoint.clone().sub(this.position);
        p.rotateY(-this.heading);
        return p;
    }

    integrate(dt) {
        const linearAccel = this.forceAccum.clone().scale(this.inverseMass);
        this.linearVelocity.addScaled(linearAccel, dt);

        const angAccelX = this.torqueAccum.x * this.inverseInertia.x;
        const angAccelY = this.torqueAccum.y * this.inverseInertia.y;
        const angAccelZ = this.torqueAccum.z * this.inverseInertia.z;
        this.angularVelocity.x += angAccelX * dt;
        this.angularVelocity.y += angAccelY * dt;
        this.angularVelocity.z += angAccelZ * dt;

        this.position.addScaled(this.linearVelocity, dt);
        this.heading += this.angularVelocity.y * dt;

        const angDamping = 0.98;
        this.angularVelocity.scale(angDamping);

        this.forceAccum.set(0, 0, 0);
        this.torqueAccum.set(0, 0, 0);
    }

    reset(x = 0, y = 0.5, z = 0) {
        this.position.set(x, y, z);
        this.heading = 0;
        this.linearVelocity.set(0, 0, 0);
        this.angularVelocity.set(0, 0, 0);
        this.forceAccum.set(0, 0, 0);
        this.torqueAccum.set(0, 0, 0);
    }
}
