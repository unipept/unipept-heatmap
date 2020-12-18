import Settings from "../settings";
import { HeatmapFeature } from "./HeatmapFeature";
import { HeatmapValue } from "./HeatmapValue";
let sanitizeHtml = require("sanitize-html");

export class HeatmapSettings extends Settings {
    /***** VALUES *****/
    // Amount of pixels that are allowed to be occupied by the labels of the rows in the initial heatmap position
    initialTextWidth: number = 100;

    // Amount of pixels that are allowed to be occupied by the labels of the columns in the initial heatmap position
    initialTextHeight: number = 100;

    // Space between the squares in the grid (0 for no padding)
    squarePadding: number = 2;

    // Space between the visualization grid itself and rendering the labels (in pixels). This space is applied to both
    // the rows and columns labels.
    visualizationTextPadding = 5;

    // Size of text used in the visualization (for row and column labels)
    fontSize: number = 14;

    className = 'heatmap';

    // Total speed of the reordering animations used in this visualization, should be given in milliseconds (ms).
    animationSpeed: number = 2000;

    // Should we highlight the current row and column over which the cursor is currently hovering?
    highlightSelection: boolean = true;

    highlightFontSize: number = 16;
    highlightFontColor: string = "black";

    /***** FUNCTIONS *****/
    // Default ease-in-ease-out transition
    transition: (x: number) => number = (x: number) => {
        return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    }

    // Returns the html to use as tooltip for a cell. Is called with a HeatmapValue that represents the current cell
    // and the row and column objects associated with the highlighted cell as parameters. By default, the
    // result of getTooltipTitle is used in a header and getTooltipText is used in a paragraph tag.
    getTooltip: (
        value: HeatmapValue,
        row: HeatmapFeature,
        column: HeatmapFeature
    ) => string = (value: HeatmapValue, row: HeatmapFeature, column: HeatmapFeature) => {
        return `
            <style>
                .tooltip {
                    padding: 10px;
                    border-radius: 5px; 
                    background: rgba(0, 0, 0, 0.8); 
                    color: #fff;
                }
                
                .tooltip div,a {
                    font-family: Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif;
                }
                
                .tooltip div {
                    font-weight: bold;
                }
            </style>
            <div class="tooltip">
                <div>
                    ${this.getTooltipTitle(value, row, column)}
                </div>
                <a>
                    ${this.getTooltipText(value)}
                </a>
            </div>
        `
    };

    getTooltipTitle: (
        value: HeatmapValue,
        row: HeatmapFeature,
        column: HeatmapFeature
    ) => string = (value: HeatmapValue, row: HeatmapFeature, column: HeatmapFeature) => {
        return sanitizeHtml(`${column.name ? column.name : ''}${column.name ? ' and ' : ''}${row.name ? row.name : ''}`);
    };

    // Text that's displayed inside a tooltip. This is equal to the current cell's value by default.
    getTooltipText: (x: HeatmapValue) => string = (x: HeatmapValue) => {
        return sanitizeHtml(`Similarity: ${(x.value * 100).toFixed(2)}%`);
    };
}
