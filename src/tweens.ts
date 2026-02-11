export type EasingFunction = (t: number) => number;

export const Ease = {
    outQuad: (t: number) => t * (2 - t),
    outBack: (t: number) => {
        const s = 1.70158;
        return --t * t * ((s + 1) * t + s) + 1;
    },
    inOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
};

export interface Tween {
    target: any;
    props: any;
    startProps: any;
    startTime: number;
    duration: number;
    easing: EasingFunction;
    onComplete?: () => void;
}