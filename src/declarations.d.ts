declare module 'cli-table3' {
  // Define basic constructor options that are being used
  interface TableConstructorOptions {
    head?: string[];
    colWidths?: (number | null)[];
    colAligns?: string[]; // e.g., 'left', 'center', 'right'
    rowAligns?: string[]; // e.g., 'top', 'middle', 'bottom'
    style?: {
      head?: string[]; // For colors like 'red', 'green', etc. or style like 'bold'
      border?: string[];
      compact?: boolean;
      'padding-left'?: number;
      'padding-right'?: number;
    };
    chars?: {
      'top'?: string; 'top-mid'?: string; 'top-left'?: string; 'top-right'?: string;
      'bottom'?: string; 'bottom-mid'?: string; 'bottom-left'?: string; 'bottom-right'?: string;
      'left'?: string; 'left-mid'?: string; 'mid'?: string; 'mid-mid'?: string;
      'right'?: string; 'right-mid'?: string; 'middle'?: string;
      [key: string]: string | undefined; // Allow other char definitions
    };
    wordWrap?: boolean;
    wrapOnWordBoundary?: boolean;
  }

  // Define the Table class structure based on usage
  class Table {
    constructor(options?: TableConstructorOptions);

    // Based on usage: cliTable.push(...sanitizedRows);
    // sanitizedRows is string[][], so push can take multiple arrays of strings.
    // Or it can be called like table.push(row1); table.push(row2);
    push(...rows: (string[] | { [key: string]: string })[]): void;

    toString(): string;

    // If other properties/methods of cli-table3 are used, they should be added here.
    // For example, if direct array access or length is used:
    // [index: number]: any;
    // length: number;
  }

  export = Table;
}
