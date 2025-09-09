"use client";

import { useEffect } from "react";

export const PerformanceMonitor = () => {
  useEffect(() => {
    // Monitor Core Web Vitals
    if (typeof window !== "undefined" && "PerformanceObserver" in window) {
      // Monitor Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log("LCP:", lastEntry.startTime);
        
        // Send to analytics if needed
        if (lastEntry.startTime > 2500) {
          console.warn("LCP is too slow:", lastEntry.startTime);
        }
      });
      
      try {
        lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      } catch {
        // Fallback for older browsers
      }

      // Monitor First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry & { processingStart?: number; startTime?: number }) => {
          if (entry.processingStart && entry.startTime) {
            console.log("FID:", entry.processingStart - entry.startTime);
            
            if (entry.processingStart - entry.startTime > 100) {
              console.warn("FID is too slow:", entry.processingStart - entry.startTime);
            }
          }
        });
      });
      
      try {
        fidObserver.observe({ entryTypes: ["first-input"] });
      } catch {
        // Fallback for older browsers
      }

      // Monitor Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
          if (!entry.hadRecentInput && entry.value) {
            clsValue += entry.value;
          }
        });
        console.log("CLS:", clsValue);
        
        if (clsValue > 0.1) {
          console.warn("CLS is too high:", clsValue);
        }
      });
      
      try {
        clsObserver.observe({ entryTypes: ["layout-shift"] });
      } catch {
        // Fallback for older browsers
      }

      // Monitor Time to First Byte (TTFB)
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: PerformanceEntry & { entryType?: string; responseStart?: number; requestStart?: number }) => {
          if (entry.entryType === "navigation" && entry.responseStart && entry.requestStart) {
            const ttfb = entry.responseStart - entry.requestStart;
            console.log("TTFB:", ttfb);
            
            if (ttfb > 600) {
              console.warn("TTFB is too slow:", ttfb);
            }
          }
        });
      });
      
      try {
        navigationObserver.observe({ entryTypes: ["navigation"] });
      } catch {
        // Fallback for older browsers
      }
    }

    // Monitor bundle size and loading
    if (typeof window !== "undefined") {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.entryType === "resource") {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.initiatorType === "script" || resourceEntry.initiatorType === "css") {
              console.log(`${resourceEntry.name} loaded in:`, resourceEntry.duration);
              
              if (resourceEntry.duration > 1000) {
                console.warn(`Slow resource: ${resourceEntry.name} took ${resourceEntry.duration}ms`);
              }
            }
          }
        });
      });
      
      try {
        observer.observe({ entryTypes: ["resource"] });
      } catch {
        // Fallback for older browsers
      }
    }
  }, []);

  return null; // This component doesn't render anything
};
