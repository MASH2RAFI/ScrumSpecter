import { useId } from "react";

// The "S" is a sprint loop whose ends and middle are network nodes, echoing the
// node-and-edge background; drawn on a 64x64 grid shared by every logo asset.
const Glyph = ({ nodeFill }: { nodeFill: string }) => (
    <>
        <path d="M43 20.5 L21 43.5" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" strokeLinecap="round" />
        <path
            d="M43 20.5 A11 9.25 0 1 0 32 32 A11 9.25 0 1 1 21 43.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="5.5"
            strokeLinecap="round"
        />
        <circle cx="43" cy="20.5" r="3.75" fill="currentColor" />
        <circle cx="32" cy="32" r="3" fill={nodeFill} stroke="currentColor" strokeWidth="2" />
        <circle cx="21" cy="43.5" r="3.75" fill="currentColor" />
    </>
);

// Brand badge: white glyph on the primary blue (#2563EB) gradient; reads on light and dark
export const LogoMark = ({ size = 40, className }: { size?: number; className?: string }) => {
    const gradientId = useId();

    return (
        <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="ScrumSpecter">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3B82F6" />
                    <stop offset="1" stopColor="#1D4ED8" />
                </linearGradient>
            </defs>
            <rect width="64" height="64" rx="15" fill={`url(#${gradientId})`} />
            <g className="text-white">
                <Glyph nodeFill="#BFDBFE" />
            </g>
        </svg>
    );
};

// Just the glyph in currentColor, cropped to the "S" (2:3), for places that supply their own background
export const LogoGlyph = ({ size = 40, className }: { size?: number; className?: string }) => (
    <svg width={Math.round(size * 2 / 3)} height={size} viewBox="16 8 32 48" className={className} aria-hidden="true">
        <Glyph nodeFill="transparent" />
    </svg>
);
