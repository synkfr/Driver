export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, v) => (v - a) / (b - a);
export const remap = (inLo, inHi, outLo, outHi, v) => lerp(outLo, outHi, inverseLerp(inLo, inHi, v));
export const degToRad = (d) => d * 0.017453292519943295;
export const radToDeg = (r) => r * 57.29577951308232;
export const sign = (v) => v > 0 ? 1 : v < 0 ? -1 : 0;
export const approach = (current, target, step) => {
    const diff = target - current;
    if (Math.abs(diff) <= step) return target;
    return current + sign(diff) * step;
};

export const smoothDamp = (current, target, velocityRef, smoothTime, maxSpeed, dt) => {
    smoothTime = Math.max(0.0001, smoothTime);
    const omega = 2.0 / smoothTime;
    const x = omega * dt;
    const exp = 1.0 / (1.0 + x + 0.48 * x * x + 0.235 * x * x * x);
    let change = current - target;
    const maxChange = maxSpeed * smoothTime;
    change = clamp(change, -maxChange, maxChange);
    const adjustedTarget = current - change;
    const temp = (velocityRef.value + omega * change) * dt;
    velocityRef.value = (velocityRef.value - omega * temp) * exp;
    let output = adjustedTarget + (change + temp) * exp;
    if ((target - current > 0) === (output > target)) {
        output = target;
        velocityRef.value = (output - target) / dt;
    }
    return output;
};

export const lerpTable = (table, input) => {
    const keys = table.keys;
    const values = table.values;
    if (input <= keys[0]) return values[0];
    if (input >= keys[keys.length - 1]) return values[values.length - 1];
    for (let i = 0; i < keys.length - 1; i++) {
        if (input >= keys[i] && input <= keys[i + 1]) {
            const t = (input - keys[i]) / (keys[i + 1] - keys[i]);
            return lerp(values[i], values[i + 1], t);
        }
    }
    return values[values.length - 1];
};

export class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    clone() { return new Vec3(this.x, this.y, this.z); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    scale(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    addScaled(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
    cross(v) {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        );
    }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z); }
    lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
    normalize() {
        const l = this.length();
        if (l > 1e-8) { this.x /= l; this.y /= l; this.z /= l; }
        return this;
    }
    setLength(len) { return this.normalize().scale(len); }
    negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
    distanceTo(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2 + (this.z - v.z) ** 2); }

    rotateY(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos + this.z * sin;
        const z = -this.x * sin + this.z * cos;
        this.x = x; this.z = z;
        return this;
    }

    static ZERO() { return new Vec3(0, 0, 0); }
    static UP() { return new Vec3(0, 1, 0); }
    static FORWARD() { return new Vec3(0, 0, 1); }
    static RIGHT() { return new Vec3(1, 0, 0); }
}

export class Quat {
    constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
    copy(q) { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
    clone() { return new Quat(this.x, this.y, this.z, this.w); }
    setIdentity() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; return this; }

    setFromAxisAngle(axis, angle) {
        const half = angle * 0.5;
        const s = Math.sin(half);
        this.x = axis.x * s;
        this.y = axis.y * s;
        this.z = axis.z * s;
        this.w = Math.cos(half);
        return this;
    }

    setFromEulerYXZ(yaw, pitch, roll) {
        const c1 = Math.cos(yaw * 0.5), s1 = Math.sin(yaw * 0.5);
        const c2 = Math.cos(pitch * 0.5), s2 = Math.sin(pitch * 0.5);
        const c3 = Math.cos(roll * 0.5), s3 = Math.sin(roll * 0.5);
        this.x = c1 * s2 * c3 + s1 * c2 * s3;
        this.y = s1 * c2 * c3 - c1 * s2 * s3;
        this.z = c1 * c2 * s3 - s1 * s2 * c3;
        this.w = c1 * c2 * c3 + s1 * s2 * s3;
        return this;
    }

    multiply(q) {
        const ax = this.x, ay = this.y, az = this.z, aw = this.w;
        const bx = q.x, by = q.y, bz = q.z, bw = q.w;
        this.x = aw * bx + ax * bw + ay * bz - az * by;
        this.y = aw * by - ax * bz + ay * bw + az * bx;
        this.z = aw * bz + ax * by - ay * bx + az * bw;
        this.w = aw * bw - ax * bx - ay * by - az * bz;
        return this;
    }

    normalize() {
        const l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
        if (l > 1e-8) { this.x /= l; this.y /= l; this.z /= l; this.w /= l; }
        return this;
    }

    rotateVec3(v) {
        const qx = this.x, qy = this.y, qz = this.z, qw = this.w;
        const ix = qw * v.x + qy * v.z - qz * v.y;
        const iy = qw * v.y + qz * v.x - qx * v.z;
        const iz = qw * v.z + qx * v.y - qy * v.x;
        const iw = -qx * v.x - qy * v.y - qz * v.z;
        return new Vec3(
            ix * qw + iw * -qx + iy * -qz - iz * -qy,
            iy * qw + iw * -qy + iz * -qx - ix * -qz,
            iz * qw + iw * -qz + ix * -qy - iy * -qx
        );
    }

    toEuler() {
        const sinr = 2 * (this.w * this.x + this.y * this.z);
        const cosr = 1 - 2 * (this.x * this.x + this.y * this.y);
        const pitch = Math.atan2(sinr, cosr);
        const sinp = 2 * (this.w * this.y - this.z * this.x);
        const yaw = Math.abs(sinp) >= 1 ? Math.sign(sinp) * Math.PI / 2 : Math.asin(sinp);
        const siny = 2 * (this.w * this.z + this.x * this.y);
        const cosy = 1 - 2 * (this.y * this.y + this.z * this.z);
        const roll = Math.atan2(siny, cosy);
        return { pitch, yaw, roll };
    }

    forward() { return this.rotateVec3(new Vec3(0, 0, 1)); }
    right() { return this.rotateVec3(new Vec3(1, 0, 0)); }
    up() { return this.rotateVec3(new Vec3(0, 1, 0)); }
}
