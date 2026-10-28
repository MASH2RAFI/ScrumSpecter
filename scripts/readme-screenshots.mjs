#!/usr/bin/env node
// Turns the raw shots from e2e/readme-shots.spec.ts into the README's screenshots:
//   docs/screenshots/<light|dark>/desktop/<view>.png   copied as they are
//   docs/screenshots/<light|dark>/mobile/<view>.png    phone-sized, with rounded screen corners
// The long phone capture of Home is cut between cards into phone-height screens, each starting
// with the app's top bar, so it reads like scrolling down the page.
//
// Usage: node scripts/readme-screenshots.mjs <folder with the raw shots>
// Needs ImageMagick (`magick`).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RAW = process.argv[2];
if (!RAW) {
    console.error("Usage: node scripts/readme-screenshots.mjs <folder with the raw shots>");
    process.exit(1);
}

const OUT = "docs/screenshots";
const PHONE = { width: 390, height: 844 };
// The app's top bar on a phone
const TOP_BAR = 71;
// At most this many screens from the Home capture
const HOME_SCREENS = 4;
const DESKTOP_VIEWS = ["home", "kanban", "table", "task-panel", "analytics", "routines"];
const THEMES = {
    light: { page: "#E8ECE9", edge: "#CFD8D2" },
    dark: { page: "#0C110E", edge: "#2B3530" },
};

const magick = (...args) => execFileSync("magick", args);
const tmp = mkdtempSync(join(tmpdir(), "readme-shots-"));

// One column of an image as grey levels, one byte per row
const column = (file, x, height) => magick(file, "-crop", `1x${height}+${x}+0`, "+repage", "-colorspace", "Gray", "-depth", "8", "gray:-");

const heightOf = (file) => Number(magick("identify", "-format", "%h", file).toString());

// Rows between cards: the same shade as the page edge all the way across (checking several
// points, so a heading with a button at the far end isn't mistaken for a gap)
const gapMiddles = (file) => {
    const height = heightOf(file);
    const across = [40, 120, Math.round(PHONE.width / 2), 270, 350].map((x) => column(file, x, height));
    const edge = column(file, 3, height);
    const middles = [];
    let start = -1;
    for (let y = 0; y <= height; y++) {
        const gap = y < height && across.every((col) => Math.abs(col[y] - edge[y]) <= 4);
        if (gap && start < 0) start = y;
        if (!gap && start >= 0) {
            if (y - start >= 8) middles.push(Math.round((start + y) / 2));
            start = -1;
        }
    }
    return { height, middles };
};

// Rounded screen corners and a hairline edge, like a phone
const frame = (input, output, theme) => {
    const mask = join(tmp, "mask.png");
    magick("-size", `${PHONE.width}x${PHONE.height}`, "xc:none", "-fill", "white",
        "-draw", `roundrectangle 0,0 ${PHONE.width - 1},${PHONE.height - 1} 34,34`, mask);
    magick(input, "-background", THEMES[theme].page, "-gravity", "north", "-extent", `${PHONE.width}x${PHONE.height}`,
        mask, "-alpha", "off", "-compose", "CopyOpacity", "-composite",
        "-fill", "none", "-stroke", THEMES[theme].edge, "-strokewidth", "2",
        "-draw", `roundrectangle 1,1 ${PHONE.width - 2},${PHONE.height - 2} 34,34`, output);
};

// Cuts as low as fits in one screen each (the first is a whole screen; later ones repeat the top bar)
const homeCuts = ({ height, middles }) => {
    const cuts = [0];
    while (cuts.length <= HOME_SCREENS && cuts.at(-1) < height - 40) {
        const start = cuts.at(-1);
        const room = start === 0 ? PHONE.height : PHONE.height - TOP_BAR;
        const fits = middles.filter((y) => y > start + 150 && y <= start + room);
        cuts.push(fits.length ? fits.at(-1) : Math.min(height, start + room));
    }
    return cuts.slice(0, HOME_SCREENS + 1);
};

const HOME_NAMES = ["home-1", "home-2", "home-3", "home-4"];

for (const theme of Object.keys(THEMES)) {
    const desktop = join(OUT, theme, "desktop");
    const mobile = join(OUT, theme, "mobile");
    mkdirSync(desktop, { recursive: true });
    mkdirSync(mobile, { recursive: true });

    for (const view of DESKTOP_VIEWS) {
        copyFileSync(join(RAW, `${theme}-desktop-${view}.png`), join(desktop, `${view}.png`));
    }

    for (const view of ["kanban", "menu"]) {
        frame(join(RAW, `${theme}-phone-${view}.png`), join(mobile, `${view}.png`), theme);
    }

    const home = join(RAW, `${theme}-phone-home.png`);
    const topBar = join(tmp, "top-bar.png");
    magick(home, "-crop", `${PHONE.width}x${TOP_BAR}+0+0`, "+repage", topBar);
    const cuts = homeCuts(gapMiddles(home));
    for (let i = 0; i < cuts.length - 1; i++) {
        const body = join(tmp, "body.png");
        const screen = join(tmp, "screen.png");
        magick(home, "-crop", `${PHONE.width}x${cuts[i + 1] - cuts[i]}+0+${cuts[i]}`, "+repage", body);
        if (i === 0) copyFileSync(body, screen);
        else magick(topBar, body, "-append", screen);
        frame(screen, join(mobile, `${HOME_NAMES[i]}.png`), theme);
    }
    console.log(`${theme}: ${DESKTOP_VIEWS.length} desktop, ${cuts.length - 1} Home screens (cuts ${cuts.join(", ")}), kanban, menu`);
}

rmSync(tmp, { recursive: true, force: true });
