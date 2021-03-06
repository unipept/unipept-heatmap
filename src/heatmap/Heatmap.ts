import * as d3 from "d3";
import HeatmapSettings from "./HeatmapSettings";
import UPGMAClusterer from "../cluster/UPGMAClusterer";
import EuclidianDistanceMetric from "../metric/EuclidianDistanceMetric";
import ClusterElement from "../cluster/ClusterElement";
import TreeNode from "../cluster/TreeNode";
import Reorderer from "../reorder/Reorderer";
import MoloReorderer from "../reorder/MoloReorderer";
import HeatmapFeature from "./HeatmapFeature";
import HeatmapValue from "./HeatmapValue";
import Preprocessor from "./Preprocessor";

import "core-js/stable";
import "regenerator-runtime/runtime";
import SVGOptions from "./../svg/SVGOptions";

type ViewPort = {
    xTop: number,
    yTop: number,
    xBottom: number,
    yBottom: number
};

export default class Heatmap {
    private element: HTMLElement;
    private settings: HeatmapSettings;

    private rows: HeatmapFeature[];
    private columns: HeatmapFeature[];
    private values: HeatmapValue[][];
    private valuesPerColor: Map<string, [number, number][]>;

    // private tooltip: d3.Selection<HTMLDivElement, any, HTMLElement, any> | null = null;

    private originalViewPort: ViewPort;
    private currentViewPort: ViewPort;

    private visElement: d3.Selection<HTMLCanvasElement, unknown, HTMLElement, any>;
    private context: CanvasRenderingContext2D;

    // Which portion of the visualisation is currently reserved for the text?
    private textWidth: number;
    private textHeight: number;

    private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null = null;

    private highlightedRow: number = -1;
    private highlightedColumn: number = -1;

    private pixelRatio: number;

    private lastZoomStatus: { k: number, x: number, y: number } = {
        k: 1,
        x: 0,
        y: 0
    };

    constructor(
        elementIdentifier: HTMLElement,
        values: number[][],
        rowLabels: string[],
        columnLabels: string[],
        options: HeatmapSettings = new HeatmapSettings()
    ) {
        this.settings = this.fillOptions(options);

        this.element = elementIdentifier;
        this.element.id = "U_HEATMAP_" + Math.floor(Math.random() * 2**16);

        const preprocessor = new Preprocessor();
        this.rows = preprocessor.preprocessFeatures(rowLabels);
        this.columns = preprocessor.preprocessFeatures(columnLabels);

        this.values = preprocessor.preprocessValues(
            values,
            this.settings.minColor,
            this.settings.maxColor,
            this.settings.colorBuckets
        );
        this.valuesPerColor = preprocessor.orderPerColor(this.values);

        if (this.settings.enableTooltips) {
            this.tooltip = this.initTooltip();
        }

        this.pixelRatio = window.devicePixelRatio || 1;

        // Initialize the viewport with the default width and height of the visualization
        this.originalViewPort = {
            xTop: 0,
            yTop: 0,
            xBottom: options.width,
            yBottom: options.height
        }

        this.currentViewPort = this.originalViewPort;

        this.textWidth = this.settings.initialTextWidth;
        this.textHeight = this.settings.initialTextHeight;

        // Add a canvas to the desired element and set it's required properties
        this.element.innerHTML = "";

        this.visElement = d3.select("#" + this.element.id)
            .append("canvas")
            .attr("width", this.pixelRatio * this.settings.width)
            .attr("height", this.pixelRatio * this.settings.height)
            .attr("style", `width: ${this.settings.width}px; height: ${this.settings.height}px`)
            .on("mouseover", () => this.tooltipMove(d3.event))
            .on("mousemove", () => this.tooltipMove(d3.event))
            .on("mouseout", () => this.tooltipMove(d3.event));
        this.context = this.visElement.node()!.getContext("2d")!;
        this.context.scale(this.pixelRatio, this.pixelRatio);

        const zoom = d3.zoom()
            .extent([[0, 0], [this.settings.width, this.settings.height]])
            .scaleExtent([0.25, 12])
            .on("zoom", () => {
                this.zoomed(d3.event.transform);
            });

        // @ts-ignore
        this.visElement.call(zoom);

        this.redraw();
    }

    private fillOptions(options: any = undefined): HeatmapSettings {
        let output = new HeatmapSettings();
        return Object.assign(output, options);
    }

    /**
     * Reset the complete view to it's initial state with the options and data passed in the constructor.
     */
    public reset() {
        this.redraw();
    }

    /**
     * Cluster the data found in the Heatmap according to the default clustering algorithm.
     * @param toCluster One of "all", "columns" or "rows". "All" denotes that clustering on both the rows and columns
     * should be performed. "Columns" denotes that clustering should only be clustered on the columns only. "Rows"
     * denotes that the clustering is performed on the rows only.
     */
    public async cluster(toCluster: "all" | "columns" | "rows" | "none" = "all") {
        let clusterer = new UPGMAClusterer(new EuclidianDistanceMetric());

        let molo: Reorderer = new MoloReorderer();

        let rowOrder: number[] = Array.from(Array(this.rows.length).keys())
        let inverseRowOrder: number[] = new Array(rowOrder.length);

        if (toCluster === "all" || toCluster === "rows") {
            // Create a new ClusterElement for every row that exists. This ClusterElement keeps track of an array of
            // numbers that correspond to a row's values.
            let rowElements: ClusterElement[] = this.rows.map((el, idx) => new ClusterElement(
                this.values[idx].filter(val => val.rowId == el.idx).map(x => x.value), el.idx!)
            );

            // Now we perform a depth first search on the result in order to find the order of the values
            rowOrder = this.determineOrder(molo.reorder(clusterer.cluster(rowElements)));
            for (const [idx, row] of Object.entries(rowOrder)) {
                inverseRowOrder[row] = Number.parseInt(idx);
            }
        }

        let columnOrder: number[] = Array.from(Array(this.columns.length).keys())
        let inverseColumnOrder: number[] = new Array(columnOrder.length);

        if (toCluster === "all" || toCluster === "columns") {
            // Create a new ClusterElement for every column that exists.
            let columnElements: ClusterElement[] = this.columns.map(
                (el, idx) => new ClusterElement(
                    this.values.map(col => col[idx].value),
                    el.idx!
                )
            );

            columnOrder = this.determineOrder(clusterer.cluster(columnElements));
            for (const [idx, col] of Object.entries(columnOrder)) {
                inverseColumnOrder[col] = Number.parseInt(idx);
            }
        }

        const animationDuration = this.settings.animationsEnabled ? this.settings.animationDuration / 2 : 0;

        // Function that animates the movement of the rows and columns
        const createAnimator = (rowOrder: number[], columnOrder: number[]) => {
            return new Promise<void>((resolve) => {
                let animationStart: number;

                const animateRows = (timestamp: number) => {
                    if (animationStart === undefined) {
                        animationStart = timestamp;
                    }
                    const elapsed = timestamp - animationStart;

                    const animationStep = this.settings.transition(elapsed / animationDuration);
                    this.redraw(rowOrder, columnOrder, animationStep);

                    if (elapsed < animationDuration) {
                        requestAnimationFrame(animateRows);
                    } else {
                        resolve();
                    }
                };

                requestAnimationFrame(animateRows);
            });
        }

        // First animate rows
        const columnIdentity = Array.from(Array(this.columns.length).keys());
        await createAnimator(inverseRowOrder, columnIdentity);

        let newValues = [];
        // Swap rows into the correct position
        for (const row of rowOrder) {
            newValues.push(this.values[row]);
        }

        // Swap row titles
        const newRowTitles = [];
        for (const row of rowOrder) {
            newRowTitles.push(this.rows[row]);
        }

        const preprocessor = new Preprocessor();

        this.rows = newRowTitles;
        this.values = newValues;
        this.valuesPerColor = preprocessor.orderPerColor(this.values);

        // Then animate columns
        const rowIdentity = Array.from(Array(this.rows.length).keys());
        await createAnimator(rowIdentity, inverseColumnOrder);

        newValues = [];
        // Swap columns
        for (const row of rowIdentity) {
            let newRow: HeatmapValue[] = [];
            for (const column of columnOrder) {
                newRow.push(this.values[row][column]);
            }
            newValues.push(newRow);
        }

        // Swap column titles
        const newColumnTitles = [];
        for (const col of columnOrder) {
            newColumnTitles.push(this.columns[col]);
        }

        this.columns = newColumnTitles;
        this.values = newValues;
        this.valuesPerColor = preprocessor.orderPerColor(this.values);

        this.redraw();
    }

    public resize(newWidth: number, newHeight: number) {
        this.settings.width = newWidth;
        this.settings.height = newHeight;

        this.visElement.attr("height", this.pixelRatio * newHeight);
        this.visElement.attr("width", this.pixelRatio * newWidth);
        this.visElement.attr("style", `width: ${this.settings.width}px; height: ${this.settings.height}px`);
        this.context.scale(this.pixelRatio, this.pixelRatio);

        this.originalViewPort = {
            xTop: 0,
            yTop: 0,
            xBottom: newWidth,
            yBottom: newHeight
        }

        this.zoomed(this.lastZoomStatus);
    }

    /**
     * Convert the heatmap to an SVG-string that can easily be downloaded as a valid SVG-file. Note that the current
     * positioning and zooming level of the heatmap will not be taken into account (but clustering will!).
     *
     * Note that this function can take a while to compute for larger heatmaps. It is recommended to start this
     * function in a dedicated worker in order not to block the main JS thread.
     *
     * @return A string that represents the content of a valid SVG file.
     */
    public toSVG(options: SVGOptions = new SVGOptions()): string {
        const dimension = options.squareDimension;

        let svgContents = "";

        // First produce SVG-contents for all squares in the heatmap
        for (const [color, values] of this.valuesPerColor) {
            for (const [row, col] of values) {
                const xTop = col * (dimension + options.squarePadding);
                const yTop = row * (dimension + options.squarePadding);

                svgContents += `
                    <rect width="${dimension}" height="${dimension}" fill="${color}" x="${xTop}" y="${yTop}"></rect>
                `
            }
        }

        const offscreenCanvas = new OffscreenCanvas(1, 1);
        const ctx = offscreenCanvas.getContext("2d");

        ctx!.font = `${options.fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;

        // Then add the row and colum titles to the heatmap
        const x = dimension * this.columns.length + options.squarePadding * (this.columns.length - 1) + options.visualizationTextPadding;
        const textCenter = Math.max((dimension - options.fontSize) / 2, 0);

        let maximumWidth: number = x;
        for (let row = 0; row < this.rows.length; row++) {
            const y = (dimension + options.squarePadding) * row + textCenter;

            svgContents += `
                <text 
                    x="${x}" 
                    y="${y}" 
                    font-size="${options.fontSize}" 
                    dominant-baseline="hanging" 
                    fill="black"
                    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
                >
                    ${this.rows[row].name}
                </text>
            `;

            // Compute the length of the label in pixels
            const computedWidth: number = ctx!.measureText(this.rows[row].name).width + x;
            if (computedWidth > maximumWidth) {
                maximumWidth = computedWidth;
            }
        }

        const y = dimension * this.rows.length + options.squarePadding * (this.rows.length - 1) + options.visualizationTextPadding;
        let maximumHeight: number = y;

        for (let col = 0; col < this.columns.length; col++) {
            const x = (dimension + options.squarePadding) * col + textCenter;

            svgContents += `
                <text 
                    x="${x}" 
                    y="${y}" 
                    font-size="${options.fontSize}" 
                    text-anchor="start" 
                    fill="black"
                    transform="rotate(90, ${x}, ${y})"
                    font-family="'Helvetica Neue', Helvetica, Arial, sans-serif"
                >
                    ${this.columns[col].name}
                </text>
            `;

            const computedWidth: number = ctx!.measureText(this.columns[col].name).width + y;
            if (computedWidth > maximumHeight) {
                maximumHeight = computedWidth;
            }
        }

        return `
            <svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(maximumWidth)}" height="${Math.ceil(maximumHeight)}">
                ${svgContents}
            </svg>
        `;
    }

    /**
     * Extracts a linear order from a dendrogram by following all branches up to leaves in a depth-first ordering.
     *
     * @param treeNode Root of a dendrogram for which a linear leaf ordering needs to be extracted.
     */
    private determineOrder(treeNode: TreeNode): number[] {
        return treeNode.values.map(item => item.id);
    }

    /**
     * Determines the dimensions of one square based upon the current width and height-settings and the amount of rows
     * and columns currently set to be visualized.
     */
    private determineSquareWidth(
        viewPort = this.currentViewPort,
        textWidth: number = this.textWidth,
        textHeight: number = this.textHeight
    ) {
        const visualizationWidth = viewPort.xBottom -
            viewPort.xTop -
            this.columns.length * this.settings.squarePadding -
            textWidth;
        const visualizationHeight = viewPort.yBottom -
            viewPort.yTop -
            this.rows.length * this.settings.squarePadding -
            textHeight;

        // Squares should at least be one pixel in height
        let squareWidth = Math.max(1, visualizationWidth / this.columns.length);
        let squareHeight = Math.max(1, visualizationHeight / this.rows.length);

        return Math.min(squareWidth, squareHeight);
    }

    private computeTextStartX(
        viewPort = this.currentViewPort,
        textWidth: number = this.textWidth,
        textHeight: number = this.textHeight
    ): number {
        return viewPort.xTop +
            this.determineSquareWidth(viewPort, textWidth, textHeight) * this.columns.length +
            this.settings.squarePadding * (this.columns.length - 1) +
            this.settings.visualizationTextPadding;
    }

    private computeTextStartY(
        viewPort = this.currentViewPort,
        textWidth: number = this.textWidth,
        textHeight: number = this.textHeight
    ): number {
        return viewPort.yTop +
            this.determineSquareWidth(viewPort, textWidth, textHeight) * this.rows.length +
            this.settings.squarePadding * (this.rows.length - 1) +
            this.settings.visualizationTextPadding;
    }

    private zoomed({ k, x, y }: { k: number, x: number, y: number }) {
        this.lastZoomStatus = { k, x, y };

        const newTextStartX = x + this.computeTextStartX(
            this.originalViewPort,
            this.settings.initialTextWidth,
            this.settings.initialTextHeight
        ) * k;

        const newTextStartY = y + this.computeTextStartY(
            this.originalViewPort,
            this.settings.initialTextWidth,
            this.settings.initialTextHeight
        ) * k;

        const comparator: (x: number, y: number) => number = (x, y) => {
            if (x > y) {
                return y;
            } else if (k >= 1) {
                return Math.min(x, y);
            } else {
                return Math.max(x, y);
            }
        };

        // Recalculate the current viewport
        this.currentViewPort = {
            xTop: x + this.originalViewPort.xTop * k,
            yTop: y + this.originalViewPort.yTop * k,
            xBottom: comparator(x + this.originalViewPort.xBottom * k, this.originalViewPort.xBottom),
            yBottom: comparator(y + this.originalViewPort.yBottom * k, this.originalViewPort.yBottom)
        }

        this.textWidth = this.currentViewPort.xBottom - newTextStartX;
        this.textHeight = this.currentViewPort.yBottom - newTextStartY;

        this.redraw();
    }

    /**
     * Redraw the complete Heatmap and clear the view first. This function accepts three optional arguments that
     * determine the current animation state (if requested).
     *
     * @param newRowPositions Current position of the rows. Row[i] = j denotes that the i'th row in the original grid
     * should move to position j.
     * @param newColumnPositions New positions of the columns. Column[i] = j denotes that i'th column in the original
     * grid should move to position j.
     * @param animationStep A decimal number (in [0, 1]) that denotes the current animation progress. If 0.7 is passed
     * as a value, 70% of the animation has already passed.
     */
    private redraw(
        newRowPositions: number[] = Array.from(Array(this.rows.length).keys()),
        newColumnPositions: number[] = Array.from(Array(this.columns.length).keys()),
        animationStep: number = 0
    ) {
        this.redrawGrid(newRowPositions, newColumnPositions, animationStep);
        this.redrawRowTitles(newRowPositions, animationStep);
        this.redrawColumnTitles(newColumnPositions, animationStep);
    }

    private redrawGrid(
        newRowPositions: number[],
        newColumnPositions: number[],
        animationStep: number
    ) {
        let squareWidth = this.determineSquareWidth();

        this.context.clearRect(0, 0, this.settings.width, this.settings.height);

        for (const [color, values] of this.valuesPerColor) {
            this.context.beginPath();
            this.context.fillStyle = color;

            for (const [row, col] of values) {
                // First compute the positions at the start of the animation
                const xTopStart = this.currentViewPort.xTop + col * (squareWidth + this.settings.squarePadding);
                const yTopStart = this.currentViewPort.yTop + row * (squareWidth + this.settings.squarePadding);

                // Then compute the positions at the end of the animation
                const xTopEnd = this.currentViewPort.xTop + newColumnPositions[col] * (squareWidth + this.settings.squarePadding);
                const yTopEnd = this.currentViewPort.yTop + newRowPositions[row] * (squareWidth + this.settings.squarePadding);

                const xDifference = xTopEnd - xTopStart;
                const yDifference = yTopEnd - yTopStart;

                let xTopCurrent = xTopStart + xDifference * animationStep;
                let yTopCurrent = yTopStart + yDifference * animationStep;
                let xBottomCurrent = xTopCurrent + (squareWidth + this.settings.squarePadding);
                let yBottomCurrent = yTopCurrent + (squareWidth + this.settings.squarePadding);

                // We do not need to draw the current square
                if (xBottomCurrent < 0 || xTopCurrent > this.settings.width) {
                    continue;
                }

                if (yBottomCurrent < 0 || yTopCurrent > this.settings.height) {
                    continue;
                }

                if (this.settings.highlightSelection && row == this.highlightedRow && col == this.highlightedColumn) {
                    // Add a highlight border around the currently selected square
                    this.context.save();
                    this.context.fillStyle = this.settings.maxColor;
                    this.context.fillRect(
                        xTopCurrent - this.settings.squarePadding,
                        yTopCurrent - this.settings.squarePadding,
                        squareWidth + 2 * this.settings.squarePadding,
                        squareWidth + 2 * this.settings.squarePadding
                    );
                    this.context.restore();
                }

                this.context.fillRect(
                    xTopCurrent,
                    yTopCurrent,
                    squareWidth,
                    squareWidth
                );
            }

            this.context.closePath();
        }
    }

    /**
     * Add ellipsis characters to the string, if it does not fit onto the screen.
     *
     * @param input The string to which an ellipsis should be added, if required.
     * @param width The maximum width that the string should occupy.
     * @return A string to which an ellipsis has been added, if it was required.
     */
    private ellipsizeString(input: string, width: number): string {
        const computedWidth = this.context.measureText(input);

        if (computedWidth.width > width) {
            let i = input.length;
            let output = input.substr(0, i) + "...";
            while (this.context.measureText(output).width > width && i > 0) {
                i--;
                output = input.substr(0, i) + "...";
            }

            if (i === 0) {
                return "";
            }

            return output;
        } else {
            return input;
        }
    }

    private redrawRowTitles(
        newRowPositions: number[],
        animationStep: number
    ) {
        const squareWidth = this.determineSquareWidth();

        // Per how many items should we display a text item? (padding is 8)
        const stepSize: number = Math.max(Math.floor((this.settings.fontSize + 12) / (squareWidth + this.settings.squarePadding)), 1);

        const textStart = this.computeTextStartX();
        let textCenter = Math.max((squareWidth - this.settings.fontSize) / 2, 0);

        this.context.save();

        this.context.fillStyle = this.settings.labelColor;
        this.context.textBaseline = "top";
        this.context.textAlign = "start"
        this.context.font = `${this.settings.fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        for (let i = 0; i < this.rows.length; i += stepSize) {
            const row = this.rows[i];

            if (this.settings.highlightSelection && i == this.highlightedRow) {
                this.context.save();
                this.context.fillStyle = this.settings.highlightFontColor;
                this.context.font = `${this.settings.highlightFontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
                textCenter = Math.max((squareWidth - this.settings.highlightFontSize) / 2, 0);
            }

            const originalY = this.currentViewPort.yTop + (squareWidth + this.settings.squarePadding) * i + textCenter;
            const endY = this.currentViewPort.yTop + (squareWidth + this.settings.squarePadding) * newRowPositions[i] + textCenter;

            const difference = endY - originalY;
            const currentY = originalY + difference * animationStep;

            this.context.fillText(
                this.ellipsizeString(row.name, this.textWidth),
                textStart,
                currentY
            );

            if (this.settings.highlightSelection && i == this.highlightedRow) {
                this.context.restore();
            }
        }

        this.context.restore();
    }

    private redrawColumnTitles(
        newColumnPositions: number[],
        animationStep: number
    ) {
        let squareWidth = this.determineSquareWidth();

        // Per how many items should we display a text item? (padding is 8)
        let stepSize: number = Math.max(Math.floor((this.settings.fontSize + 12) / (squareWidth + this.settings.squarePadding)), 1);

        let textStart = this.computeTextStartY();
        let textCenter = Math.max((squareWidth - this.settings.fontSize) / 2, 0);

        this.context.save();
        this.context.rotate((90 * Math.PI) / 180);
        this.context.fillStyle = "#404040";
        this.context.textBaseline = "bottom";
        this.context.textAlign = "start";
        this.context.font = `${this.settings.fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        for (let i = 0; i < this.columns.length; i += stepSize) {
            const col = this.columns[i];

            if (this.settings.highlightSelection && i == this.highlightedColumn) {
                this.context.save();
                this.context.fillStyle = this.settings.highlightFontColor;
                this.context.font = `${this.settings.highlightFontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
                textCenter = Math.max((squareWidth - this.settings.highlightFontSize) / 2, 0);
            }

            const originalX = -(this.currentViewPort.xTop + (squareWidth + this.settings.squarePadding) * i + textCenter);
            const endX = -(this.currentViewPort.xTop + (squareWidth + this.settings.squarePadding) * newColumnPositions[i] + textCenter);

            const difference = endX - originalX;
            const currentX = originalX + difference * animationStep;

            // The axis of the canvas also rotate 90 degrees clockwise
            this.context.fillText(
                this.ellipsizeString(col.name, this.textHeight),
                textStart,
                currentX
            );

            if (this.settings.highlightSelection && i == this.highlightedColumn) {
                this.context.restore();
            }
        }

        this.context.restore();
    }

    private initTooltip() {
        return d3.select("body")
            .append("div")
            .attr("id", this.element.id + "-tooltip")
            .attr("class", "tip")
            .style("position", "absolute")
            .style("z-index", "10")
            .style("visibility", "hidden");
    }

    private findRowAndColForPosition(x: number, y: number): [number, number] {
        const currentX = x - this.currentViewPort.xTop;
        const currentY = y - this.currentViewPort.yTop;

        const squareWidth = this.determineSquareWidth();

        const row = Math.floor(currentY / (squareWidth + this.settings.squarePadding));
        const col = Math.floor(currentX / (squareWidth + this.settings.squarePadding));

        return [row, col];
    }

    private tooltipMove(event: MouseEvent) {
        // Find out which element is situated under the current mouse position.
        // @ts-ignore
        const rect = event.target.getBoundingClientRect();
        const [row, col] = this.findRowAndColForPosition(event.clientX - rect.left, event.clientY - rect.top);

        if (row < 0 || row >= this.rows.length || col < 0 || col >= this.columns.length) {
            if (this.settings.enableTooltips && this.tooltip) {
                this.tooltip.style("visibility", "hidden");
            }

            this.highlightedRow = -1;
            this.highlightedColumn = -1;

            if (this.settings.highlightSelection) {
                this.redraw();
            }

            return;
        }

        this.highlightedRow = row;
        this.highlightedColumn = col;

        if (this.settings.highlightSelection) {
            this.redraw();
        }

        if (this.settings.enableTooltips && this.tooltip) {
            this.tooltip.html(this.settings.getTooltip(this.values[row][col], this.rows[row], this.columns[col]))
                .style("top", (event.pageY + 10) + "px")
                .style("left", (event.pageX + 10) + "px")
                .style("visibility", "visible");
        }
    }
}
