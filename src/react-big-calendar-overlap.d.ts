// react-big-calendar's own "overlap" day layout, reused by the calendar's layered layout
declare module "react-big-calendar/lib/utils/layout-algorithms/overlap" {
    import type { DayLayoutFunction } from "react-big-calendar";

    const overlap: <TEvent extends object>(...args: Parameters<DayLayoutFunction<TEvent>>) => ReturnType<DayLayoutFunction<TEvent>>;
    export default overlap;
}
