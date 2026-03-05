"use client";

import {
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UuidBulkSelector } from "@/components/uuid-bulk-selector";
import type { Resume } from "./columns";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
};

export function DataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
  });

  const getPageNumbers = (): number[] => {
    const totalPages = table.getPageCount();
    const currentPage = table.getState().pagination.pageIndex;

    if (totalPages <= 3) {
      return Array.from({ length: totalPages }, (_, i) => i);
    }

    if (currentPage === 0) {
      return [0, 1, 2];
    }
    if (currentPage === totalPages - 1) {
      return [totalPages - 3, totalPages - 2, totalPages - 1];
    }
    return [currentPage - 1, currentPage, currentPage + 1];
  };

  const headerCount = table.getHeaderGroups()[0]?.headers.length || 0;

  return (
    <div>
      <div className="flex items-center gap-4 py-4">
        <UuidBulkSelector data={data as Resume[]} />
      </div>
      <div className="w-full overflow-x-auto rounded-md border">
        <Table className="w-full">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isLastColumn = index === headerCount - 1;
                  return (
                    <TableHead
                      className={isLastColumn ? "flex-1" : ""}
                      key={header.id}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const isLastColumn = index === headerCount - 1;
                    return (
                      <TableCell
                        className={isLastColumn ? "justify-right flex-1" : ""}
                        key={cell.id}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center"
                  colSpan={columns.length}
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-muted-foreground text-sm">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.setPageIndex(0)}
            size="sm"
            variant="outline"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {getPageNumbers().map((pageNum) => (
            <Button
              key={pageNum}
              onClick={() => table.setPageIndex(pageNum)}
              size="sm"
              variant={
                table.getState().pagination.pageIndex === pageNum
                  ? "default"
                  : "outline"
              }
            >
              {pageNum + 1}
            </Button>
          ))}

          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            size="sm"
            variant="outline"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
