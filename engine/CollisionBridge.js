import { Vec3, clamp } from './MathUtils.js';
import { pitch, blockSize, blocksPerSide } from '../game/environment.js';

export class CollisionBridge {
    constructor(config = {}) {
        this.worldBounds = config.worldBounds || 500;
        this.contacts = [];
    }

    testCollision(position, radius = 2.0) {
        this.contacts.length = 0;

        const halfBounds = this.worldBounds;
        if (Math.abs(position.x) > halfBounds) {
            const nx = position.x > 0 ? -1 : 1;
            this.contacts.push({
                normal: new Vec3(nx, 0, 0),
                penetration: Math.abs(position.x) - halfBounds,
                impactSpeed: 0,
            });
        }
        if (Math.abs(position.z) > halfBounds) {
            const nz = position.z > 0 ? -1 : 1;
            this.contacts.push({
                normal: new Vec3(0, 0, nz),
                penetration: Math.abs(position.z) - halfBounds,
                impactSpeed: 0,
            });
        }

        const gridX = Math.round(position.x / pitch);
        const gridZ = Math.round(position.z / pitch);

        if (Math.abs(gridX) <= 1 && Math.abs(gridZ) <= 1) return this.contacts;
        if (Math.abs(gridX) > blocksPerSide / 2 || Math.abs(gridZ) > blocksPerSide / 2) return this.contacts;

        const blockCenterX = gridX * pitch;
        const blockCenterZ = gridZ * pitch;
        const dx = position.x - blockCenterX;
        const dz = position.z - blockCenterZ;
        const half = (blockSize / 2) + radius;

        if (Math.abs(dx) < half && Math.abs(dz) < half) {
            const penX = half - Math.abs(dx);
            const penZ = half - Math.abs(dz);

            if (penX < penZ) {
                this.contacts.push({
                    normal: new Vec3(dx > 0 ? 1 : -1, 0, 0),
                    penetration: penX,
                    impactSpeed: 0,
                });
            } else {
                this.contacts.push({
                    normal: new Vec3(0, 0, dz > 0 ? 1 : -1),
                    penetration: penZ,
                    impactSpeed: 0,
                });
            }
        }

        return this.contacts;
    }

    getTerrainHeight(x, z) {
        return 0;
    }

    getTerrainNormal(x, z) {
        return new Vec3(0, 1, 0);
    }

    reset() {
        this.contacts.length = 0;
    }
}
