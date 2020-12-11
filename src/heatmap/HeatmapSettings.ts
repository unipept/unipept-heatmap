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

    /***** FUNCTIONS *****/

    // Returns the html to use as tooltip for a cell. Is called with a HeatmapValue that represents the current cell
    // and the row and column objects associated with the highlighted cell as parameters. By default, the
    // result of getTooltipTitle is used in a header and getTooltipText is used in a paragraph tag.
    getTooltip: (
        value: HeatmapValue,
        row: HeatmapFeature,
        column: HeatmapFeature
    ) => string = (value: HeatmapValue, row: HeatmapFeature, column: HeatmapFeature) => {
        return `
            <b class='tip-title' style="font-family: Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;">${this.getTooltipTitle(value, row, column)}</b>
            <br>
            <a style="font-family: Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif;">${this.getTooltipText(value)}</a>
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
        return sanitizeHtml(`score: ${(x.value * 100).toFixed(2)}%`);
    };
}
