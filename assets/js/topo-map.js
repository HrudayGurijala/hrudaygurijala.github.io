// topo-map.js - Reusable Topographical Map Canvas
class TopoMap {
    constructor(canvasId, options = {}) {
        // Configuration options with defaults
        this.config = {
            showFPS: options.showFPS || false,
            maxFPS: options.maxFPS || 0,
            thresholdIncrement: options.thresholdIncrement || 40,
            thickLineThresholdMultiple: options.thickLineThresholdMultiple || 2,
            res: options.res || 4,
            // baseZOffset: options.baseZOffset || ,
            baseZOffset: options.baseZOffset || 0.0025,
            lineColor: options.lineColor || '#ffea00',
            backgroundColor: options.backgroundColor || '#000000',
            enableMouseInteraction: options.enableMouseInteraction !== false,
            ...options
        };
        
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id "${canvasId}" not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.perlin = new PerlinNoise();
        
        // Initialize variables
        this.frameValues = [];
        this.inputValues = [];
        this.currentThreshold = 0;
        this.cols = 0;
        this.rows = 0;
        this.zOffset = 0;
        this.zBoostValues = [];
        this.noiseMin = 100;
        this.noiseMax = 0;
        this.mousePos = { x: -99, y: -99 };
        this.mouseDown = true;
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupFPS();
        this.animate();
    }
    
    setupCanvas() {
        // Set canvas background
        this.canvas.style.backgroundColor = this.config.backgroundColor;
        
        this.canvasSize();
        window.addEventListener('resize', () => this.canvasSize());
        
        if (this.config.enableMouseInteraction) {
            this.canvas.addEventListener('mousemove', (e) => {
                const rect = this.canvas.getBoundingClientRect();
                this.mousePos = { 
                    x: e.clientX - rect.left, 
                    y: e.clientY - rect.top 
                };
            });
        }
    }
    
    setupFPS() {
        if (this.config.showFPS) {
            this.fpsElement = document.createElement('div');
            this.fpsElement.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                padding: 0.4rem;
                background-color: rgba(0, 0, 0, 0.5);
                color: white;
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
            `;
            this.canvas.parentElement.style.position = 'relative';
            this.canvas.parentElement.appendChild(this.fpsElement);
        }
    }
    
    canvasSize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.cols = Math.floor(this.canvas.width / this.config.res) + 1;
        this.rows = Math.floor(this.canvas.height / this.config.res) + 1;
        
        // Initialize zBoostValues
        this.zBoostValues = [];
        for (let y = 0; y < this.rows; y++) {
            this.zBoostValues[y] = [];
            for (let x = 0; x <= this.cols; x++) {
                this.zBoostValues[y][x] = 0;
            }
        }
    }
    
    animate() {
        const startTime = performance.now();
        
        const animateFrame = () => {
            if (this.config.enableMouseInteraction && this.mouseDown) {
                this.mouseOffset();
            }
            
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.zOffset += this.config.baseZOffset;
            this.generateNoise();
            
            const roundedNoiseMin = Math.floor(this.noiseMin / this.config.thresholdIncrement) * this.config.thresholdIncrement;
            const roundedNoiseMax = Math.ceil(this.noiseMax / this.config.thresholdIncrement) * this.config.thresholdIncrement;
            
            for (let threshold = roundedNoiseMin; threshold < roundedNoiseMax; threshold += this.config.thresholdIncrement) {
                this.currentThreshold = threshold;
                this.renderAtThreshold();
            }
            
            this.noiseMin = 100;
            this.noiseMax = 0;
            
            // FPS calculation
            if (this.config.showFPS) {
                const endTime = performance.now();
                const frameDuration = endTime - startTime;
                this.frameValues.push(Math.round(1000 / frameDuration));
                
                if (this.frameValues.length > 60) {
                    this.fpsElement.textContent = `FPS: ${Math.round(this.frameValues.reduce((a, b) => a + b) / this.frameValues.length)}`;
                    this.frameValues = [];
                }
            }
            
            this.animationId = requestAnimationFrame(animateFrame);
        };
        
        if (this.config.maxFPS > 0) {
            setTimeout(() => {
                this.animationId = requestAnimationFrame(animateFrame);
            }, 1000 / this.config.maxFPS);
        } else {
            this.animationId = requestAnimationFrame(animateFrame);
        }
    }
    
    mouseOffset() {
        let x = Math.floor(this.mousePos.x / this.config.res);
        let y = Math.floor(this.mousePos.y / this.config.res);
        
        if (this.inputValues[y] === undefined || this.inputValues[y][x] === undefined) return;
        
        const incrementValue = 0.0025;
        const radius = 5;
        
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                const distanceSquared = i * i + j * j;
                const radiusSquared = radius * radius;
                
                if (distanceSquared <= radiusSquared && this.zBoostValues[y + i]?.[x + j] !== undefined) {
                    this.zBoostValues[y + i][x + j] += incrementValue * (1 - distanceSquared / radiusSquared);
                }
            }
        }
    }
    
    generateNoise() {
        for (let y = 0; y < this.rows; y++) {
            this.inputValues[y] = [];
            for (let x = 0; x <= this.cols; x++) {
                this.inputValues[y][x] = this.perlin.noise(x * 0.02, y * 0.02, this.zOffset + this.zBoostValues[y]?.[x]) * 100;
                if (this.inputValues[y][x] < this.noiseMin) this.noiseMin = this.inputValues[y][x];
                if (this.inputValues[y][x] > this.noiseMax) this.noiseMax = this.inputValues[y][x];
                if (this.zBoostValues[y]?.[x] > 0) {
                    this.zBoostValues[y][x] *= 0.99;
                }
            }
        }
    }
    
    renderAtThreshold() {
        this.ctx.beginPath();
        this.ctx.strokeStyle = this.config.lineColor;
        this.ctx.lineWidth = this.currentThreshold % (this.config.thresholdIncrement * this.config.thickLineThresholdMultiple) === 0 ? 2 : 1;
        
        for (let y = 0; y < this.inputValues.length - 1; y++) {
            for (let x = 0; x < this.inputValues[y].length - 1; x++) {
                if (this.inputValues[y][x] > this.currentThreshold && this.inputValues[y][x + 1] > this.currentThreshold && 
                    this.inputValues[y + 1][x + 1] > this.currentThreshold && this.inputValues[y + 1][x] > this.currentThreshold) continue;
                if (this.inputValues[y][x] < this.currentThreshold && this.inputValues[y][x + 1] < this.currentThreshold && 
                    this.inputValues[y + 1][x + 1] < this.currentThreshold && this.inputValues[y + 1][x] < this.currentThreshold) continue;
                
                let gridValue = this.binaryToType(
                    this.inputValues[y][x] > this.currentThreshold ? 1 : 0,
                    this.inputValues[y][x + 1] > this.currentThreshold ? 1 : 0,
                    this.inputValues[y + 1][x + 1] > this.currentThreshold ? 1 : 0,
                    this.inputValues[y + 1][x] > this.currentThreshold ? 1 : 0
                );
                
                this.placeLines(gridValue, x, y);
            }
        }
        this.ctx.stroke();
    }
    
    placeLines(gridValue, x, y) {
        let nw = this.inputValues[y][x];
        let ne = this.inputValues[y][x + 1];
        let se = this.inputValues[y + 1][x + 1];
        let sw = this.inputValues[y + 1][x];
        let a, b, c, d;
        
        switch (gridValue) {
            case 1:
            case 14:
                c = [x * this.config.res + this.config.res * this.linInterpolate(sw, se), y * this.config.res + this.config.res];
                d = [x * this.config.res, y * this.config.res + this.config.res * this.linInterpolate(nw, sw)];
                this.line(d, c);
                break;
            case 2:
            case 13:
                b = [x * this.config.res + this.config.res, y * this.config.res + this.config.res * this.linInterpolate(ne, se)];
                c = [x * this.config.res + this.config.res * this.linInterpolate(sw, se), y * this.config.res + this.config.res];
                this.line(b, c);
                break;
            case 3:
            case 12:
                b = [x * this.config.res + this.config.res, y * this.config.res + this.config.res * this.linInterpolate(ne, se)];
                d = [x * this.config.res, y * this.config.res + this.config.res * this.linInterpolate(nw, sw)];
                this.line(d, b);
                break;
            case 11:
            case 4:
                a = [x * this.config.res + this.config.res * this.linInterpolate(nw, ne), y * this.config.res];
                b = [x * this.config.res + this.config.res, y * this.config.res + this.config.res * this.linInterpolate(ne, se)];
                this.line(a, b);
                break;
            case 5:
                a = [x * this.config.res + this.config.res * this.linInterpolate(nw, ne), y * this.config.res];
                b = [x * this.config.res + this.config.res, y * this.config.res + this.config.res * this.linInterpolate(ne, se)];
                c = [x * this.config.res + this.config.res * this.linInterpolate(sw, se), y * this.config.res + this.config.res];
                d = [x * this.config.res, y * this.config.res + this.config.res * this.linInterpolate(nw, sw)];
                this.line(d, a);
                this.line(c, b);
                break;
            case 6:
            case 9:
                a = [x * this.config.res + this.config.res * this.linInterpolate(nw, ne), y * this.config.res];
                c = [x * this.config.res + this.config.res * this.linInterpolate(sw, se), y * this.config.res + this.config.res];
                this.line(c, a);
                break;
            case 7:
            case 8:
                a = [x * this.config.res + this.config.res * this.linInterpolate(nw, ne), y * this.config.res];
                d = [x * this.config.res, y * this.config.res + this.config.res * this.linInterpolate(nw, sw)];
                this.line(d, a);
                break;
            case 10:
                a = [x * this.config.res + this.config.res * this.linInterpolate(nw, ne), y * this.config.res];
                b = [x * this.config.res + this.config.res, y * this.config.res + this.config.res * this.linInterpolate(ne, se)];
                c = [x * this.config.res + this.config.res * this.linInterpolate(sw, se), y * this.config.res + this.config.res];
                d = [x * this.config.res, y * this.config.res + this.config.res * this.linInterpolate(nw, sw)];
                this.line(a, b);
                this.line(c, d);
                break;
        }
    }
    
    line(from, to) {
        this.ctx.moveTo(from[0], from[1]);
        this.ctx.lineTo(to[0], to[1]);
    }
    
    linInterpolate(x0, x1, y0 = 0, y1 = 1) {
        if (x0 === x1) return 0;
        return y0 + ((y1 - y0) * (this.currentThreshold - x0)) / (x1 - x0);
    }
    
    binaryToType(nw, ne, se, sw) {
        let a = [nw, ne, se, sw];
        return a.reduce((res, x) => (res << 1) | x);
    }
    
    // Public methods
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.fpsElement) {
            this.fpsElement.remove();
        }
    }
    
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}

// Perlin Noise Class
class PerlinNoise {
    constructor() {
        this.gradients = {};
        this.memory = {};
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    
    noise(x, y, z) {
        const floorX = Math.floor(x);
        const floorY = Math.floor(y);
        const floorZ = Math.floor(z);
        
        const X = floorX & 255;
        const Y = floorY & 255;
        const Z = floorZ & 255;
        
        x -= floorX;
        y -= floorY;
        z -= floorZ;
        
        const u = this.fade(x);
        const v = this.fade(y);
        const w = this.fade(z);
        
        const A = this.p[X] + Y;
        const AA = this.p[A] + Z;
        const AB = this.p[A + 1] + Z;
        const B = this.p[X + 1] + Y;
        const BA = this.p[B] + Z;
        const BB = this.p[B + 1] + Z;
        
        return this.lerp(
            this.lerp(
                this.lerp(
                    this.grad(this.p[AA], x, y, z),
                    this.grad(this.p[BA], x - 1, y, z),
                    u
                ),
                this.lerp(
                    this.grad(this.p[AB], x, y - 1, z),
                    this.grad(this.p[BB], x - 1, y - 1, z),
                    u
                ),
                v
            ),
            this.lerp(
                this.lerp(
                    this.grad(this.p[AA + 1], x, y, z - 1),
                    this.grad(this.p[BA + 1], x - 1, y, z - 1),
                    u
                ),
                this.lerp(
                    this.grad(this.p[AB + 1], x, y - 1, z - 1),
                    this.grad(this.p[BB + 1], x - 1, y - 1, z - 1),
                    u
                ),
                v
            ),
            w
        );
    }
    
    get p() {
        if (!this._p) {
            this._p = [];
            for (let i = 0; i < 256; i++) {
                this._p[i] = Math.floor(Math.random() * 256);
            }
            for (let i = 0; i < 256; i++) {
                this._p[256 + i] = this._p[i];
            }
        }
        return this._p;
    }
}

// Auto-initialize if canvas exists
document.addEventListener('DOMContentLoaded', function() {
    const topoCanvas = document.getElementById('topo-bg');
    if (topoCanvas) {
        window.topoMap = new TopoMap('topo-bg');
    }
});