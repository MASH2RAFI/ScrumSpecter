"use client"

import * as React from "react"

import {
    ColumnDef,
    ColumnFiltersState,
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
  // Rows can be ticked; the bar acts on the ticked rows (e.g. bulk edit)
  selection?: {
    getRowId: (row: TData) => string
    renderBar: (selected: TData[], clear: () => void) => React.ReactNode
  }
}

const selectColumn = <TData,>(): ColumnDef<TData> => ({
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
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        />
    ),
    enableSorting: false,
})

export function DataTable<TData, TValue>({
  columns,
  data,
  selection,
}: DataTableProps<TData, TValue>) {
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
    const allColumns = React.useMemo(
        () => (selection ? [selectColumn<TData>() as ColumnDef<TData, TValue>, ...columns] : columns),
        [columns, selection],
    )
    const [sorting, setSorting]= React.useState<SortingState>([])

    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

    const table = useReactTable({
        data,
        columns: allColumns,
        getRowId: selection ? (row) => selection.getRowId(row) : undefined,
        enableRowSelection: Boolean(selection),
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
            sorting,
            columnFilters,
            rowSelection,
        },
  })

  // Ticked rows that are still in the data (a filter or a delete may have removed some)
  const selected = table.getSelectedRowModel().rows.map((row) => row.original)

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