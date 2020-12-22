import HeatmapSettings from "./HeatmapSettings";
import "core-js/stable";
import "regenerator-runtime/runtime";
export default class Heatmap {
    private element;
    private settings;
    private rows;
    private columns;
    private values;
    private valuesPerColor;
    private originalViewPort;
    private currentViewPort;
    private visElement;
    private context;
    private textWidth;
    private textHeight;
    private tooltip;
    private highlightedRow;
    private highlightedColumn;
    private pixelRatio;
    constructor(elementIdentifier: HTMLElement, values: number[][], rowLabels: string[], columnLabels: string[], options?: HeatmapSettings);
    private fillOptions;
    /**
     * Reset the complete view to it's initial state with the options and data passed in the constructor.
     */
    reset(): void;
    /**
     * Cluster the data found in the Heatmap according to the default clustering algorithm.
     * @param toCluster One of "all", "columns" or "rows". "All" denotes that clustering on both the rows and columns
     * should be performed. "Columns" denotes that clustering should only be clustered on the columns only. "Rows"
     * denotes that the clustering is performed on the rows only.
     */
    cluster(toCluster?: "all" | "columns" | "rows" | "none"): Promise<void>;
    setFullScreen(fullscreen: boolean): void;
    /**
     * Extracts a linear order from a dendrogram by following all branches up to leaves in a depth-first ordering.
     *
     * @param treeNode Root of a dendrogram for which a linear leaf ordering needs to be extracted.
     */
    private determineOrder;
    /**
     * Determines the dimensions of one square based upon the current width and height-settings and the amount of rows
     * and columns currently set to be visualized.
     */
    private determineSquareWidth;
    private computeTextStartX;
    private computeTextStartY;
    private zoomed;
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
    private redraw;
    private redrawGrid;
    /**
     * Add ellipsis characters to the string, if it does not fit onto the screen.
     *
     * @param input The string to which an ellipsis should be added, if required.
     * @param width The maximum width that the string should occupy.
     * @return A string to which an ellipsis has been added, if it was required.
     */
    private ellipsizeString;
    private redrawRowTitles;
    private redrawColumnTitles;
    private initTooltip;
    private findRowAndColForPosition;
    private tooltipMove;
}