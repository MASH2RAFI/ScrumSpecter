import { CSV_BOM, csvRow } from "./format";

// Saves a blob as a file through a temporary link
export const saveBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

// Downloads an export endpoint's file; a refused export throws its error message
export const downloadFrom = async (url: string, filename: string) => {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "Export failed");
    }
    saveBlob(await response.blob(), filename);
};

// Query string from defined, non-empty values
export const toQuery = (params: Record<string, string | null | undefined>) =>
    new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

export const downloadCsv = (rows: unknown[][], filename: string) =>
    saveBlob(new Blob([CSV_BOM, ...rows.map(csvRow)], { type: "text/csv;charset=utf-8" }), filename);

// null: no value that day (a gap in a line, no bar)
type Series = { name: string; values: (number | null)[]; color: string; dashed?: boolean };

// A chart drawn from its numbers onto a canvas and saved as PNG: lines (burndown) or bars
// (velocity, capacity). Light background, so it reads the same wherever it's pasted.
export const downloadChartPng = ({ title, kind, labels, series, unit = "", filename }: {
    title: string; kind: "line" | "bar"; labels: string[]; series: Series[]; unit?: string; filename: string;
}) => {
    const width = 1200, height = 675, scale = 2;
    const pad = { left: 80, right: 40, top: 80, bottom: 90 };
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(title, pad.left, 44);

    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const max = Math.max(1, ...series.flatMap((s) => s.values.flatMap((value) => value ?? [])));
    const y = (value: number) => pad.top + plotH - (value / max) * plotH;

    // Grid and y labels
    ctx.font = "14px system-ui, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
        const value = (max * i) / 4;
        ctx.strokeStyle = "#e2e8f0";
        ctx.beginPath();
        ctx.moveTo(pad.left, y(value));
        ctx.lineTo(width - pad.right, y(value));
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.fillText(`${Math.round(value * 10) / 10}${unit}`, pad.left - 10, y(value) + 5);
    }

    // x labels, thinned out when crowded
    const step = plotW / Math.max(1, labels.length);
    const every = Math.ceil(labels.length / 20);
    ctx.textAlign = "center";
    labels.forEach((label, i) => {
        if (i % every) return;
        ctx.fillText(label.length > 16 ? `${label.slice(0, 15)}…` : label, pad.left + step * (i + 0.5), pad.top + plotH + 24);
    });

    series.forEach((s, index) => {
        ctx.strokeStyle = ctx.fillStyle = s.color;
        if (kind === "line") {
            ctx.lineWidth = 3;
            ctx.setLineDash(s.dashed ? [8, 8] : []);
            ctx.beginPath();
            let drawing = false;
            s.values.forEach((value, i) => {
                if (value === null) { drawing = false; return; }
                (drawing ? ctx.lineTo : ctx.moveTo).call(ctx, pad.left + step * (i + 0.5), y(value));
                drawing = true;
            });
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            const barW = (step * 0.7) / series.length;
            s.values.forEach((value, i) => {
                if (value === null) return;
                ctx.fillRect(pad.left + step * (i + 0.15) + barW * index, y(value), barW, pad.top + plotH - y(value));
            });
        }
    });

    // Legend
    ctx.textAlign = "left";
    let x = pad.left;
    for (const s of series) {
        ctx.fillStyle = s.color;
        ctx.fillRect(x, height - 36, 16, 16);
        ctx.fillStyle = "#0f172a";
        ctx.fillText(s.name, x + 24, height - 23);
        x += 40 + ctx.measureText(s.name).width;
    }

    canvas.toBlob((blob) => blob && saveBlob(blob, filename), "image/png");
};
