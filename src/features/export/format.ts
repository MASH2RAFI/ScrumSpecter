// Text formats for exports, written by hand (no dependencies). Pure, so the server routes and
// the analytics downloads in the browser share them.

// A spreadsheet runs a cell that starts with one of these as a formula; a leading ' keeps it text
const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    let text = String(value);
    if (FORMULA_START.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
};

export const csvRow = (cells: unknown[]) => `${cells.map(csvCell).join(",")}\r\n`;

// UTF-8 byte order mark, so Excel reads non-Latin names correctly
export const CSV_BOM = "\uFEFF";

// iCalendar (RFC 5545) text value: backslash, ; and , escaped, line breaks as \n
export const icsText = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n|\r/g, "\\n");

// Lines longer than 75 octets continue on the next line after CRLF + space, never inside a
// multi-byte character
export const icsLine = (line: string) => {
    const encoder = new TextEncoder();
    let out = "";
    let bytes = 0;
    for (const char of line) {
        const size = encoder.encode(char).length;
        if (bytes + size > 75) {
            out += "\r\n ";
            bytes = 1;
        }
        out += char;
        bytes += size;
    }
    return `${out}\r\n`;
};

// 20261103T043000Z
export const icsUtc = (instant: Date) => instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// YYYY-MM-DD -> 20261103
export const icsDate = (date: string) => date.replace(/-/g, "");

// A "quoted" value for a bulk-input script; the tokenizer reads \" and \\ inside quotes, and a
// script is one command per line, so line breaks become spaces
export const bulkQuote = (value: string) =>
    `"${value.replace(/\s*\r?\n\s*/g, " ").replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
