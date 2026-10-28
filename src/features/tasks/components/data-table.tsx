"use client"

import * as React from "react"

import {
    ColumnDef,
    ColumnFiltersState,
    PaginationState,
    RowSelectionState,
    SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"


interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  // The server pages and sorts (large workspaces): `data` is just this page
  server?: {
    pageIndex: number
    pageCount: number
    onPageChange: (pageIndex: number) => void
    sorting: SortingState
    onSortingChange: (sorting: SortingState) => void
  }
  // Clicking a row (not one of its buttons or menus) opens it, e.g. in the side panel
  onRowClick?: (row: TData) => void
  // Rows can be ticked; the bar acts on the ticked rows (e.g. bulk edit)
  selection?: {
    getRowId: (row: TData) => string
    renderBar: (selected: TData[], clear: () => void) => React.ReactNode
  }
}

type SelectMode = "toggle" | "range"
type SelectHandler = { current: ((rowId: string, mode: SelectMode) => void) | null }

// Clicks on a row's own controls (and on portalled menus opened from it) aren't row clicks
const ROW_CONTROLS = "button, a, input, select, textarea, [role=checkbox], [role=menuitem], [data-row-click-ignore]"

const selectColumn = <TData,>(select: SelectHandler): ColumnDef<TData> => ({
    id: "select",
    header: ({ table }) => (
        <Checkbox
            aria-label="Select all on this page"
            className="size-4 min-h-0 min-w-0"
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
        />
    ),
    cell: ({ row }) => (
        <Checkbox
            aria-label="Select task"
            className="size-4 min-h-0 min-w-0"
            checked={row.getIsSelected()}
            // Handled here rather than by the checkbox, so Shift-click can tick a whole range
            onClick={(e) => {
                e.preventDefault()
                select.current?.(row.id, e.shiftKey ? "range" : "toggle")
            }}
        />
    ),
    enableSorting: false,
})

export function DataTable<TData, TValue>({
  columns,
  data,
  server,
  onRowClick,
  selection,
}: DataTableProps<TData, TValue>) {
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
    // Set below once the table exists; the checkbox column calls it
    const selectRef = React.useRef<SelectHandler["current"]>(null)
    const allColumns = React.useMemo(
        () => (selection ? [selectColumn<TData>(selectRef) as ColumnDef<TData, TValue>, ...columns] : columns),
        [columns, selection],
    )
    const [localSorting, setLocalSorting] = React.useState<SortingState>([])
    const sorting = server?.sorting ?? localSorting
    const [localPagination, setLocalPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
    const pagination = server ? { pageIndex: server.pageIndex, pageSize: data.length || 1 } : localPagination

    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns: allColumns,
        getRowId: selection ? (row) => selection.getRowId(row) : undefined,
        enableRowSelection: Boolean(selection),
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        // Server mode: the rows are already this page, in order
        manualPagination: Boolean(server),
        manualSorting: Boolean(server),
        pageCount: server?.pageCount,
        getPaginationRowModel: server ? undefined : getPaginationRowModel(),
        getSortedRowModel: server ? undefined : getSortedRowModel(),
        onSortingChange: (updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            if (server) server.onSortingChange(next); else setLocalSorting(next)
        },
        onPaginationChange: (updater) => {
            const next = typeof updater === "function" ? updater(pagination) : updater
            if (server) server.onPageChange(next.pageIndex); else setLocalPagination(next)
        },
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            rowSelection,
            pagination,
        },
  })

  // Ticked rows that are still in the data (a filter or a delete may have removed some)
  const selected = table.getSelectedRowModel().rows.map((row) => row.original)

  // The row a Shift-click range starts from: the last one ticked or clicked on this page
  const anchor = React.useRef<number | null>(null)
  const pageKey = `${pagination.pageIndex}:${JSON.stringify(sorting)}`
  React.useEffect(() => { anchor.current = null }, [pageKey])

  // Toggle one row, or (Shift) set the range from the anchor to the clicked row's new state,
  // as Gmail and file managers do
  selectRef.current = (rowId, mode) => {
    const rows = table.getRowModel().rows
    const index = rows.findIndex((row) => row.id === rowId)
    const row = rows[index]
    if (!row) return
    const target = !row.getIsSelected()
    if (mode === "range" && anchor.current !== null && rows[anchor.current]) {
        const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)]
        setRowSelection((current) => {
            const next = { ...current }
            for (const { id } of rows.slice(from, to + 1)) {
                if (target) next[id] = true
                else delete next[id]
            }
            return next
        })
    } else {
        row.toggleSelected(target)
    }
    anchor.current = index
  }

  const rowClick = (row: { id: string; original: TData }) => (e: React.MouseEvent<HTMLTableRowElement>) => {
    const target = e.target as HTMLElement
    // Events from portalled menus bubble through React, but aren't inside the row
    if (!e.currentTarget.contains(target) || target.closest(ROW_CONTROLS)) return
    if (selection && (e.shiftKey || e.metaKey || e.ctrlKey)) {
        selectRef.current?.(row.id, e.shiftKey ? "range" : "toggle")
        return
    }
    // Selecting text in a row isn't a click on it
    if (window.getSelection()?.toString()) return
    onRowClick?.(row.original)
  }

  return (
    <div className="w-full">
        {selection && selected.length > 0 && selection.renderBar(selected, () => setRowSelection({}))}
        {/* Scrolls inside its own box so the header can stay pinned */}
        <div className="max-h-[70vh] overflow-auto rounded-md border">
            <Table>
                <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_hsl(var(--border))]">
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                <TableHead key={header.id} className="whitespace-nowrap">
                                    {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                        )}
                                </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                        <TableRow
                            key={row.id}
                            data-state={row.getIsSelected() && "selected"}
                            onClick={onRowClick || selection ? rowClick(row) : undefined}
                            // Shift-click selects rows; without this the browser highlights text across them
                            onMouseDown={selection ? (e) => { if (e.shiftKey) e.preventDefault() } : undefined}
                            className={onRowClick ? "cursor-pointer" : undefined}
                        >
                            {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id} className="whitespace-nowrap">
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                            ))}
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={allColumns.length} className="h-24 text-center">
                            No results.
                        </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-4">
            <div className="text-sm text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    className="min-h-[44px] sm:min-h-[32px]"
                >
                    Previous
                </Button>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    className="min-h-[44px] sm:min-h-[32px]"
                >
                    Next
                </Button>
            </div>
        </div>
    </div>
    
  )
}