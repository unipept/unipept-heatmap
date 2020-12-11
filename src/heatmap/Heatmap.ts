import * as d3 from "d3";
import { HeatmapSettings } from "./heatmapSettings";
import UPGMAClusterer from "../cluster/UPGMAClusterer";
import EuclidianDistanceMetric from "../metric/euclidianDistanceMetric";
import ClusterElement from "../cluster/clusterElement";
import TreeNode from "../cluster/treeNode";
import Reorderer from "../reorder/reorderer";
import MoloReorder from "../reorder/moloReorderer";
import { HeatmapFeature } from "./HeatmapFeature";
import { HeatmapValue } from "./HeatmapValue";
import Preprocessor from "./Preprocessor";

type ViewPort = {
    xTop: number,
    yTop: number,
    xBottom: number,
    yBottom: number
};

export class Heatmap {
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

    private readonly MARGIN = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
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

        this.values = preprocessor.preprocessValues(values);
        this.valuesPerColor = preprocessor.colorize(this.values);

        if (this.settings.enableTooltips) {
            this.tooltip = this.initTooltip();
        }

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
            .attr("width", this.settings.width)
            .attr("height", this.settings.height)
            .on("mouseover", () => this.tooltipMove(d3.event))
            .on("mousemove", () => this.tooltipMove(d3.event))
            .on("mouseout", () => this.tooltipOut(d3.event));
        this.context = this.visElement.node()!.getContext("2d")!;

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
    public cluster(toCluster: "all" | "columns" | "rows" | "none" = "all") {
        // let clusterer = new UPGMAClusterer(new EuclidianDistanceMetric());
        //
        // let molo: Reorderer = new MoloReorderer();
        //
        // //@ts-ignore
        // let rowOrder: number[] = Array.apply(null, {length: this.rows.length}).map(Number.call, Number);
        // if (toCluster === "all" || toCluster === "rows") {
        //     // Create a new ClusterElement for every row that exists. This ClusterElement keeps track of an array of numbers that correspond to a row's values.
        //     let rowElements: ClusterElement[] = this.rows.map((el, idx) => new ClusterElement(this.values[idx].filter(val => val.rowId == el.id).map(x => x.value), el.id!));
        //     // Now we perform a depth first search on the result in order to find the order of the values
        //     rowOrder = this.determineOrder(molo.reorder(clusterer.cluster(rowElements)), (id: string) => this.rowMap.get(id)!.idx!);
        // }
        //
        // //@ts-ignore
        // let columnOrder: number[] = Array.apply(null, {length: this.rows.length}).map(Number.call, Number);
        // if (toCluster === "all" || toCluster === "columns") {
        //     // Create a new ClusterElement for every column that exists.
        //     let columnElements: ClusterElement[] = this.columns.map((el, idx) => new ClusterElement(this.values.map(col => col[idx].value), el.id!));
        //     columnOrder = this.determineOrder(clusterer.cluster(columnElements), (id: string) => this.columnMap.get(id)!.idx!);
        // }
        //
        // let newValues = [];
        // // Swap rows and columns
        // for (let row of rowOrder) {
        //     let newRow: HeatmapValue[] = [];
        //     for (let column of columnOrder) {
        //         newRow.push(this.values[row][column]);
        //     }
        //     newValues.push(newRow);
        // }
        // this.values = newValues;
        //
        // let squareWidth = this.determineSquareWidth();
        // let textCenter = Math.max((squareWidth - this.settings.fontSize) / 2, 0);
        //
        // // First animate the rows
        // for (let i = 0; i < this.rows.length; i++) {
        //     let newLocation = rowOrder.indexOf(i);
        //     let row = this.rows[i];
        //
        //     d3.selectAll(".row-" + row.id)
        //         .transition()
        //         .duration(this.settings.animationSpeed / 2)
        //         .attr("y", (d) => newLocation * squareWidth + newLocation * this.settings.squarePadding);
        //
        //     d3.select(".row-label-" + row.id)
        //         .transition()
        //         .duration(this.settings.animationSpeed / 2)
        //         .attr("y",  (d) => (squareWidth + this.settings.squarePadding) * newLocation + textCenter);
        // }
        //
        // let textStart = squareWidth * this.rows.length + this.settings.squarePadding * (this.rows.length - 1) + this.settings.visualizationTextPadding;
        //
        // // Then animate the columns in the same way
        // for (let i = 0; i < this.columns.length; i++) {
        //     let newLocation = columnOrder.indexOf(i);
        //     let column = this.columns[i];
        //
        //     d3.selectAll(".column-" + column.id)
        //         .transition()
        //         .delay(toCluster === "all" ? this.settings.animationSpeed / 2 : 0)
        //         .duration(this.settings.animationSpeed / 2)
        //         .attr("x", (d) => newLocation * squareWidth + newLocation * this.settings.squarePadding);
        //
        //     d3.selectAll(".column-label-" + column.id)
        //         .transition()
        //         .delay(toCluster === "all" ? this.settings.animationSpeed / 2 : 0)
        //         .duration(this.settings.animationSpeed / 2)
        //         .attr("x", (d) => (squareWidth + this.settings.squarePadding) * newLocation + textCenter)
        //         .attr("transform", (d) => `rotate(90, ${(squareWidth + this.settings.squarePadding) * newLocation + textCenter}, ${textStart})`);
        // }
        //
        // let newRows: HeatmapElement[] = [];
        // for (let rowIdx of rowOrder) {
        //     newRows.push(this.rows[rowIdx]);
        // }
        // this.rows = newRows;
        //
        // let newColumns: HeatmapElement[] = [];
        // for (let colIdx of columnOrder) {
        //     newColumns.push(this.columns[colIdx]);
        // }
        // this.columns = newColumns;
    }

    public setFullScreen(fullscreen: boolean) {
        // the delay is because the event fires before we're in fullscreen
        // so the height en width functions don't give a correct result
        // without the delay
        setTimeout(() => {
            let size = this.settings.width;
            if (fullscreen) {
                size = Math.min(window.innerWidth - 44, window.innerHeight - 250);
            }
            for (let el of this.element.getElementsByTagName("svg")) {
                el.style.width = size.toString();
                el.style.height = size.toString();
            }
        }, 1000);
    }

    /**
     * Extracts a linear order from a dendrogram by following all branches up to leaves in a depth-first ordering.
     *
     * @param treeNode Root of a dendrogram for which a linear leaf ordering needs to be extracted.
     * @param idxExtractor Function that, given an HeatmapElement's id is able to retrieve an index associated with that
     *        element.
     */
    private determineOrder(treeNode: TreeNode, idxExtractor: (x: string) => number): number[] {
        if (!treeNode.leftChild && !treeNode.rightChild) {
            return [idxExtractor(treeNode.values[0].id)];
        }

        let left: number[] = [];
        if (treeNode.leftChild) {
            left = this.determineOrder(treeNode.leftChild, idxExtractor);
        }

        let right: number[] = [];
        if (treeNode.rightChild) {
            right = this.determineOrder(treeNode.rightChild, idxExtractor);
        }

        return left.concat(right);
    }

    // /**
    //  * Append all Heatmap-specific styling to the document to which we render this information.
    //  */
    // private initCSS() {
    //     let elementClass = this.settings.className;
    //
    //     this.element.className += " " + elementClass;
    //
    //     let document: Document | null = this.element.ownerDocument;
    //     if (document != null) {
    //         let head: HTMLHeadElement = document.head;
    //         let style: HTMLStyleElement = document.createElement("style");
    //         style.type = "text/css";
    //
    //         style.innerHTML = `
    //                 .${elementClass} {
    //                     font-family: Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;
    //                 }
    //             `;
    //
    //         head.appendChild(style);
    //     } else {
    //         throw "No parent document for the given element has been set!";
    //     }
    // }

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
     * Redraw the complete Heatmap and clear the view first.
     */
    private redraw() {
        this.redrawGrid();
        this.redrawRowTitles();
        this.redrawColumnTitles();
    }

    private redrawGrid() {
        let squareWidth = this.determineSquareWidth();

        this.context.clearRect(0, 0, this.settings.width, this.settings.height);

        for (const [color, values] of this.valuesPerColor) {
            this.context.beginPath();
            this.context.fillStyle = color;

            for (const [row, col] of values) {
                const xStart = this.currentViewPort.xTop + col * (squareWidth + this.settings.squarePadding);
                const yStart = this.currentViewPort.yTop + row * (squareWidth + this.settings.squarePadding);
                const xEnd = this.currentViewPort.xTop + (col + 1) * (squareWidth + this.settings.squarePadding);
                const yEnd = this.currentViewPort.yTop + (row + 1) * (squareWidth + this.settings.squarePadding);

                // We do not need to draw the current square
                if (xEnd < 0 || xStart > this.settings.width) {
                    continue;
                }

                if (yEnd < 0 || yStart > this.settings.height) {
                    continue;
                }

                // this.context.fillStyle = interpolator(d.value);
                this.context.fillRect(
                    xStart,
                    yStart,
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

    private redrawRowTitles() {
        const squareWidth = this.determineSquareWidth();

        // Per how many items should we display a text item? (padding is 8)
        const stepSize: number = Math.max(Math.floor((this.settings.fontSize + 12) / (squareWidth + this.settings.squarePadding)), 1);

        const textStart = this.computeTextStartX();
        const textCenter = Math.max((squareWidth - this.settings.fontSize) / 2, 0);

        this.context.save();

        this.context.fillStyle = "black";
        this.context.textBaseline = "top";
        this.context.textAlign = "start"
        this.context.font = `${this.settings.fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        for (let i = 0; i < this.rows.length; i += stepSize) {
            const row = this.rows[i];
            this.context.fillText(
                this.ellipsizeString(row.name, this.textWidth),
                textStart,
                this.currentViewPort.yTop + (squareWidth + this.settings.squarePadding) * i + textCenter
            );
        }

        this.context.restore();
    }

    private redrawColumnTitles() {
        let squareWidth = this.determineSquareWidth();

        // Per how many items should we display a text item? (padding is 8)
        let stepSize: number = Math.max(Math.floor((this.settings.fontSize + 12) / (squareWidth + this.settings.squarePadding)), 1);

        let textStart = this.computeTextStartY();
        let textCenter = Math.max((squareWidth - this.settings.fontSize) / 2, 0);

        this.context.save();
        this.context.rotate((90 * Math.PI) / 180);
        this.context.fillStyle = "black";
        this.context.textBaseline = "bottom";
        this.context.textAlign = "start";
        this.context.font = `${this.settings.fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`;
        for (let i = 0; i < this.columns.length; i += stepSize) {
            const col = this.columns[i];
            // The axis of the canvas also rotate 90 degrees clockwise
            this.context.fillText(
                this.ellipsizeString(col.name, this.textHeight),
                textStart,
                -(this.currentViewPort.xTop + (squareWidth + this.settings.squarePadding) * i + textCenter)
            );
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
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("padding", "5px")
            .style("border", "1px solid #dddddd")
            .style("border-radius", "3px");
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
        if (!this.settings.enableTooltips || !this.tooltip) {
            return;
        }

        // Find out which element is situated under the current mouse position.
        const [row, col] = this.findRowAndColForPosition(event.clientX, event.clientY);

        if (row < 0 || row >= this.rows.length || col < 0 || col >= this.columns.length) {
            this.tooltipOut(event);
            return;
        }

        this.tooltip.html(this.settings.getTooltip(this.values[row][col], this.rows[row], this.columns[col]))
            .style("top", (event.clientY - 5) + "px")
            .style("left", (event.clientX + 15) + "px")
        .style("visibility", "visible");
    }

    private tooltipOut(event: MouseEvent) {
        if (!this.settings.enableTooltips || !this.tooltip) {
            return;
        }

        this.tooltip.style("visibility", "hidden");
    }
}
