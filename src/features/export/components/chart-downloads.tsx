"use client";

import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

// "Download PNG" and "Download CSV" for an analytics chart
export const ChartDownloads = ({ onPng, onCsv, disabled }: { onPng: () => void; onCsv: () => void; disabled?: boolean }) => (
    <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onPng} disabled={disabled}>
            <DownloadIcon className="mr-1.5 size-4" />
            Download PNG
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCsv} disabled={disabled}>
            <DownloadIcon className="mr-1.5 size-4" />
            Download CSV
        </Button>
    </div>
);
