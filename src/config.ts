import bunnyImage from './assets/bunny.png'; 

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

export const CONFIG = {
    maxDragDistance: 160,
    maxLaunchForce: 35, 
    maxSessionDuration: 20000, 
    tutorialAutoHideTime: 6000,
    projectileAsset: bunnyImage,
    colors: {
        ground: 0x228B22,
        slingshot: 0x442200,
        rubber: 0x301500,
        skyTop: 0x87CEEB,
        mountain: 0x708090,
        obstacle: 0xDAA520,
        platform: 0x555555,
        carrot: 0xFFA500,
        carrotLines: 0xD35400,
        leaves: 0x228B22,
        cloud: 0xFFFFFF,
        uiWin: 0x2ECC71,
        uiLose: 0xE74C3C,
        uiButton: 0x95a5a6
    }
};