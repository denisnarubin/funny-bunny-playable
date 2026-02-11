import * as PIXI from 'pixi.js';
import Matter from 'matter-js';
import { CONFIG, WORLD_WIDTH, WORLD_HEIGHT } from './config';
import { Ease, Tween } from './tweens';


interface IGameObject {
    visual: PIXI.Graphics | PIXI.Container;
    body: Matter.Body;
}

interface IProjectile {
    visual: PIXI.Sprite;
    body: Matter.Body;
    isStuck: boolean;
}

type EndScreenType = 'win' | 'lose';

class AngryBunnyGame {
    private app!: PIXI.Application;
    private engine!: Matter.Engine;
    private runner!: Matter.Runner;
    private readonly tweens: Tween[] = [];
    

    private gameScene!: PIXI.Container;
    private uiScene!: PIXI.Container;
    private backgroundLayer!: PIXI.Container;
    

    private projectile?: IProjectile;
    private obstacles: IGameObject[] = [];
    

    private readonly trajectoryLines: PIXI.Graphics = new PIXI.Graphics();
    private readonly slingshotGraphics: PIXI.Graphics = new PIXI.Graphics();
    private readonly rubberLines: PIXI.Graphics = new PIXI.Graphics();
    

    private dragStart: PIXI.IPointData | null = null; 
    private isLaunched: boolean = false;
    private isGameOver: boolean = false;
    

    private sessionTimer: ReturnType<typeof setTimeout> | null = null;
    private loseTimer: ReturnType<typeof setTimeout> | null = null;
    private tutHideTimer: ReturnType<typeof setTimeout> | null = null;
    

    private readonly slingshotPos = { x: 250, y: 450 };
    private gameScale: number = 1;
    private offsetX: number = 0;
    private offsetY: number = 0;
    private tut: PIXI.Text | null = null;

    constructor() {
        this.initApp();
        this.initPhysics();
        this.initLayers();
        this.setupWorld();
        this.setupEvents();
        this.app.ticker.add(this.update);
    }

    private initApp(): void {
        this.app = new PIXI.Application({
            resizeTo: window,
            antialias: true,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            backgroundColor: CONFIG.colors.skyTop
        });

        document.body.appendChild(this.app.view as HTMLCanvasElement);
    }

    private initPhysics(): void {
        this.engine = Matter.Engine.create();
        this.engine.gravity.y = 0.8;
        this.runner = Matter.Runner.create();
        Matter.Runner.run(this.runner, this.engine);

        Matter.Events.on(this.engine, 'collisionStart', (event: Matter.IEventCollision<Matter.Engine>) => {
            event.pairs.forEach((pair) => {
                const labels: string[] = [pair.bodyA.label, pair.bodyB.label];
                if (labels.includes('target') && labels.includes('projectile')) {
                    this.handleWin();
                }
            });
        });
    }

    private initLayers(): void {
        this.backgroundLayer = new PIXI.Container();
        this.gameScene = new PIXI.Container();
        this.uiScene = new PIXI.Container();
        this.app.stage.addChild(this.backgroundLayer, this.gameScene, this.uiScene);
    }

    private setupWorld(): void {
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        
        this.gameScene.removeChildren();
        this.uiScene.removeChildren();
        this.obstacles = [];
        this.isLaunched = false;
        this.isGameOver = false;

        this.updateSizing();
        this.createBackground();
        this.createGround();
        
        this.gameScene.addChild(this.slingshotGraphics, this.rubberLines, this.trajectoryLines);
        this.drawSlingshotStatic();
        
        this.obstacles.push(this.createObstacle(850, 580, 50, 120));
        this.obstacles.push(this.createObstacle(850, 460, 50, 120));
        this.obstacles.push(this.createObstacle(850, 390, 160, 25));
        
        this.createTarget(1100, 550);
        this.createProjectile();
        this.startTutorial();
    }

    private createBackground(): void {
        this.backgroundLayer.removeChildren();
        const sky = new PIXI.Graphics()
            .beginFill(CONFIG.colors.skyTop)
            .drawRect(0, 0, this.app.screen.width, this.app.screen.height);
        this.backgroundLayer.addChild(sky);
        
        const decor = new PIXI.Container();
        decor.scale.set(this.gameScale);
        decor.position.set(this.offsetX, this.offsetY);
        this.backgroundLayer.addChild(decor);
        
        const clouds = new PIXI.Graphics();
        const drawCloud = (g: PIXI.Graphics, x: number, y: number, scale: number): void => {
            g.beginFill(CONFIG.colors.cloud);
            g.drawCircle(x, y, 20 * scale);
            g.drawCircle(x + 15 * scale, y - 10 * scale, 15 * scale);
            g.drawCircle(x + 30 * scale, y, 18 * scale);
            g.drawCircle(x + 15 * scale, y + 10 * scale, 15 * scale);
            g.endFill();
        };
        drawCloud(clouds, 200, 100, 1.2);
        drawCloud(clouds, 500, 60, 0.8);
        drawCloud(clouds, 900, 150, 1.5);
        decor.addChild(clouds);

        const mountains = new PIXI.Graphics()
            .beginFill(CONFIG.colors.mountain, 0.5)
            .moveTo(-500, WORLD_HEIGHT)
            .lineTo(200, 300)
            .lineTo(500, 500)
            .lineTo(900, 200)
            .lineTo(WORLD_WIDTH + 500, WORLD_HEIGHT)
            .endFill();
        decor.addChild(mountains);
    }

    private createGround(): void {
        const h = 80;
        const body = Matter.Bodies.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - h / 2, WORLD_WIDTH + 2000, h, { isStatic: true });
        const g = new PIXI.Graphics()
            .beginFill(CONFIG.colors.ground)
            .drawRect(-(WORLD_WIDTH + 2000) / 2, -h / 2, WORLD_WIDTH + 2000, h);
        
        g.position.set(body.position.x, body.position.y);
        this.gameScene.addChild(g);
        Matter.World.add(this.engine.world, body);
    }

    private createObstacle(x: number, y: number, w: number, h: number): IGameObject {
        const body = Matter.Bodies.rectangle(x, y, w, h, { friction: 0.5, restitution: 0.1 });
        const visual = new PIXI.Graphics()
            .beginFill(CONFIG.colors.obstacle)
            .lineStyle(2, 0x5D4037)
            .drawRect(-w / 2, -h / 2, w, h);
            
        this.gameScene.addChild(visual);
        Matter.World.add(this.engine.world, body);
        return { body, visual };
    }

    private createTarget(x: number, y: number): void {
        const platform = Matter.Bodies.rectangle(x, y + 60, 120, 20, { isStatic: true });
        const platG = new PIXI.Graphics().beginFill(CONFIG.colors.platform).drawRect(-60, -10, 120, 20);
        platG.position.set(platform.position.x, platform.position.y);
        this.gameScene.addChild(platG);
        Matter.World.add(this.engine.world, platform);
        
        const carrotBody = Matter.Bodies.rectangle(x, y, 45, 90, { isStatic: true, label: 'target' });
        const carrotG = new PIXI.Graphics();
        carrotG.beginFill(CONFIG.colors.leaves).drawEllipse(-10, -40, 8, 15).drawEllipse(0, -45, 8, 20).drawEllipse(10, -40, 8, 15);
        carrotG.beginFill(CONFIG.colors.carrot).drawPolygon([-20, -35, 20, -35, 0, 45]).endFill();
        carrotG.lineStyle(2, CONFIG.colors.carrotLines, 0.8).moveTo(-12, -15).lineTo(8, -15).moveTo(-7, 5).lineTo(10, 5);
        
        carrotG.position.set(carrotBody.position.x, carrotBody.position.y);
        this.gameScene.addChild(carrotG);
        Matter.World.add(this.engine.world, carrotBody);
    }

    private createProjectile(): void {
        const sprite = PIXI.Sprite.from(CONFIG.projectileAsset);
        sprite.anchor.set(0.5);
        sprite.width = sprite.height = 60;
        
        const body = Matter.Bodies.circle(this.slingshotPos.x, this.slingshotPos.y, 30, { 
            isStatic: true, 
            frictionAir: 0.01, 
            label: 'projectile' 
        });
        
        this.projectile = { visual: sprite, body, isStuck: false };
        this.gameScene.addChild(sprite);
        Matter.World.add(this.engine.world, body);
    }

    private drawSlingshotStatic(): void {
        this.slingshotGraphics.clear().lineStyle(12, CONFIG.colors.slingshot)
            .moveTo(this.slingshotPos.x, WORLD_HEIGHT - 80).lineTo(this.slingshotPos.x, this.slingshotPos.y + 30)
            .lineTo(this.slingshotPos.x - 30, this.slingshotPos.y - 20).moveTo(this.slingshotPos.x, this.slingshotPos.y + 30)
            .lineTo(this.slingshotPos.x + 30, this.slingshotPos.y - 20);
    }

    private setupEvents(): void {
        this.app.stage.eventMode = 'static';
        this.app.stage.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
            if (this.isGameOver || this.isLaunched) return;
            
            if (!this.sessionTimer) {
                this.sessionTimer = setTimeout(() => {
                    if (!this.isGameOver) this.showEndScreen('lose');
                }, CONFIG.maxSessionDuration);
            }
            this.stopTutorial();
            this.dragStart = this.gameScene.toLocal(e.global);
        });

        this.app.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
            if (!this.dragStart || this.isLaunched || !this.projectile) return;
            
            const pos = this.gameScene.toLocal(e.global);
            const dx = pos.x - this.slingshotPos.x;
            const dy = pos.y - this.slingshotPos.y;
            const dist = Math.min(Math.sqrt(dx*dx + dy*dy), CONFIG.maxDragDistance);
            const angle = Math.atan2(dy, dx);
            
            const nx = this.slingshotPos.x + Math.cos(angle) * dist;
            const ny = this.slingshotPos.y + Math.sin(angle) * dist;
            
            Matter.Body.setPosition(this.projectile.body, { x: nx, y: ny });
            this.drawRubber(nx, ny);
            this.drawTrajectory(nx, ny);
        });

        window.addEventListener('pointerup', () => {
            if (!this.dragStart || this.isLaunched || !this.projectile) return;
            this.isLaunched = true;
            this.dragStart = null;
            
            const velocity = this.getLaunchVelocity(this.projectile.body.position.x, this.projectile.body.position.y);
            this.rubberLines.clear();
            this.trajectoryLines.clear();
            
            Matter.Body.setStatic(this.projectile.body, false);
            Matter.Body.setVelocity(this.projectile.body, velocity);
        });

        window.addEventListener('resize', () => {
            this.updateSizing();
            this.createBackground();
        });
    }

    private getLaunchVelocity(px: number, py: number): Matter.Vector {
        const vx = this.slingshotPos.x - px;
        const vy = this.slingshotPos.y - py;
        const dist = Math.sqrt(vx * vx + vy * vy);
        const pullRatio = dist / CONFIG.maxDragDistance;
        
        let force = pullRatio * CONFIG.maxLaunchForce;
        if (force > CONFIG.maxLaunchForce) force = CONFIG.maxLaunchForce;
        
        const angle = Math.atan2(vy, vx);
        return { x: Math.cos(angle) * force, y: Math.sin(angle) * force };
    }

    private drawRubber(x: number, y: number): void {
        this.rubberLines.clear().lineStyle(6, CONFIG.colors.rubber)
            .moveTo(this.slingshotPos.x - 25, this.slingshotPos.y - 15).lineTo(x, y)
            .moveTo(this.slingshotPos.x + 25, this.slingshotPos.y - 15).lineTo(x, y);
    }

    private drawTrajectory(x: number, y: number): void {
        this.trajectoryLines.clear().beginFill(0xFFFFFF, 0.4);
        const velocity = this.getLaunchVelocity(x, y);
        let { x: vx, y: vy } = velocity;
        let tx = x, ty = y;
        
        for (let i = 0; i < 30; i++) {
            vy += this.engine.gravity.y * 0.6;
            tx += vx * 1.6; 
            ty += vy * 1.6;
            this.trajectoryLines.drawCircle(tx, ty, 4);
        }
    }

    private animate(target: any, props: Record<string, number>, duration: number = 500, easing = Ease.outQuad) {
        const startProps: Record<string, number> = {};
        for (const key in props) startProps[key] = target[key];
        
        const tween: Tween = { 
            target, 
            props, 
            startProps, 
            startTime: performance.now(), 
            duration, 
            easing 
        };
        
        this.tweens.push(tween);
        return { then: (cb: () => void) => { tween.onComplete = cb; } };
    }

    private handleWin(): void {
        if (this.isGameOver || !this.projectile) return;
        this.isGameOver = true;
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        
        this.projectile.isStuck = true;
        Matter.Body.setStatic(this.projectile.body, true);
        this.showEndScreen('win');
    }

    private showEndScreen(type: EndScreenType): void {
        if (this.isGameOver && type === 'lose') return; 
        this.isGameOver = true;
        if (this.sessionTimer) clearTimeout(this.sessionTimer);

        const isWin = type === 'win';
        const accent = isWin ? CONFIG.colors.uiWin : CONFIG.colors.uiLose;

        const overlay = new PIXI.Graphics().beginFill(0x000000, 0.6).drawRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        overlay.alpha = 0;
        this.uiScene.addChild(overlay);

        const modal = new PIXI.Container();
        modal.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
        modal.alpha = 0;
        this.uiScene.addChild(modal);

        const card = new PIXI.Graphics()
            .beginFill(0xffffff)
            .lineStyle(8, accent)
            .drawRoundedRect(-250, -200, 500, 400, 30);
        modal.addChild(card);

        const title = new PIXI.Text(isWin ? "ПОБЕДА!" : "ПРОМАХ!", { 
            fill: accent, 
            fontSize: 60, 
            fontWeight: '900' 
        });
        title.anchor.set(0.5); 
        title.y = -30;
        modal.addChild(title);

        const btn = new PIXI.Container();
        btn.y = 100;
        const btnG = new PIXI.Graphics().beginFill(CONFIG.colors.uiButton).drawRoundedRect(-120, -35, 240, 70, 15);
        const btnT = new PIXI.Text(isWin ? "NEXT" : "RETRY", { fill: 0xffffff, fontSize: 32, fontWeight: 'bold' });
        btnT.anchor.set(0.5);
        btn.addChild(btnG, btnT);
        modal.addChild(btn);

        this.animate(overlay, { alpha: 1 }, 400);
        this.animate(modal, { alpha: 1 }, 400);
        modal.scale.set(0.5);
        this.animate(modal.scale, { x: 1, y: 1 }, 600, Ease.outBack);
    }

    private startTutorial(): void {
        this.tut = new PIXI.Text('👆', { fontSize: 80 });
        this.tut.anchor.set(0.5);
        this.uiScene.addChild(this.tut);
        
        this.tutHideTimer = setTimeout(() => this.stopTutorial(), CONFIG.tutorialAutoHideTime);

        const loop = (): void => {
            if (!this.tut) return;
            this.tut.position.set(this.slingshotPos.x, this.slingshotPos.y + 100);
            this.tut.alpha = 1;
            this.animate(this.tut, { x: this.slingshotPos.x - 100, alpha: 0 }, 1500, Ease.inOutQuad).then(loop);
        };
        loop();
    }

    private stopTutorial(): void {
        if (this.tut) {
            if (this.tutHideTimer) clearTimeout(this.tutHideTimer);
            this.uiScene.removeChild(this.tut);
            this.tut = null;
        }
    }

    private updateSizing(): void {
        const sw = this.app.screen.width;
        const sh = this.app.screen.height;
        this.gameScale = Math.min(sw / WORLD_WIDTH, sh / WORLD_HEIGHT);
        this.offsetX = (sw - WORLD_WIDTH * this.gameScale) / 2;
        this.offsetY = (sh - WORLD_HEIGHT * this.gameScale) / 2;
        
        [this.gameScene, this.uiScene].forEach((s) => {
            s.scale.set(this.gameScale);
            s.position.set(this.offsetX, this.offsetY);
        });
    }

    private update = (): void => {
        const now = performance.now();
        Matter.Engine.update(this.engine, this.app.ticker.deltaMS);


        for (let i = this.tweens.length - 1; i >= 0; i--) {
            const t = this.tweens[i];
            const progress = Math.min((now - t.startTime) / t.duration, 1);
            const eased = t.easing(progress);
            
            for (const key in t.props) {
                t.target[key] = t.startProps[key] + (t.props[key] - t.startProps[key]) * eased;
            }
            
            if (progress === 1) {
                t.onComplete?.();
                this.tweens.splice(i, 1);
            }
        }


        if (this.projectile) {
            this.projectile.visual.position.set(this.projectile.body.position.x, this.projectile.body.position.y);
            this.projectile.visual.rotation = this.projectile.body.angle;
            
            if (this.isLaunched && !this.isGameOver && !this.projectile.isStuck) {
                const b = this.projectile.body;
                if (b.position.y > WORLD_HEIGHT + 100 || b.position.x > WORLD_WIDTH + 100 || b.position.x < -100) {
                    this.showEndScreen('lose');
                } else if (b.speed < 0.15 && b.motion < 0.1) {
                    if (!this.loseTimer) {
                        this.loseTimer = setTimeout(() => {
                            if(!this.isGameOver) this.showEndScreen('lose');
                        }, 800);
                    }
                } else {
                    if (this.loseTimer) {
                        clearTimeout(this.loseTimer);
                        this.loseTimer = null;
                    }
                }
            }
        }


        this.obstacles.forEach(o => {
            o.visual.position.set(o.body.position.x, o.body.position.y);
            o.visual.rotation = o.body.angle;
        });
    };
}

new AngryBunnyGame();