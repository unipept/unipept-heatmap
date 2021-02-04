import RenderHelper from "./RenderHelper";

export default class CanvasRenderHelper implements RenderHelper {
    constructor(
        private readonly context: CanvasRenderingContext2D
    ) {}

    public renderLine(xFrom: number, yFrom: number, xTo: number, yTo: number, width: number, color: string): void {
        this.context.save();
        this.context.strokeStyle = color;
        this.context.lineWidth = width;
        this.context.moveTo(xFrom, yFrom);
        this.context.lineTo(xTo, yTo);
        this.context.stroke();
        this.context.restore();
    }
}
