import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { flexRender, useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel } from "@tanstack/react-table";
import type { ColumnDef, VisibilityState, SortingState, ColumnFiltersState, RowSelectionState, ColumnSizingState, Row, SortingFn, PaginationState } from '@tanstack/react-table';
import { Loader2, RotateCcwIcon, Settings, UserPlus, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiService } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";

interface DoctorResponse {
    success: boolean;
    message: string;
    count: number;
    data: Doctor[];
}

interface Doctor {
    _id: string;
    full_name: string;
    email: string;
    is_active: boolean;
    doctor_details: {
        speciality: string;
        availability: any[];
    } | null;
}

const DATE_COLUMN_KEYWORDS = [
    "date",
    "time",
    "dob",
    "createdat",
    "updatedat",
    "timestamp",
];

const isValidDateParts = (year: number, month: number, day: number): boolean => {
    if (year < 1900 || year > 9999) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    return true;
};

const parseDateLikeValue = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;

    if (value instanceof Date) {
        const timestamp = value.getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
        // Treat short numbers as unix seconds and large numbers as milliseconds.
        return value > 1e12 ? value : value * 1000;
    }

    if (typeof value !== "string") return null;

    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === "-") return null;

    // DICOM-like datetime: YYYYMMDD HHMMSS(.ms) or YYYYMMDD HHMM
    const dicomDateTimeMatch = trimmedValue.match(/^(\d{8})(?:\s+(\d{2,6})(?:\.\d+)?)?$/);
    if (dicomDateTimeMatch) {
        const datePart = dicomDateTimeMatch[1];
        const timePart = (dicomDateTimeMatch[2] || "").padEnd(6, "0");
        const year = Number(datePart.slice(0, 4));
        const month = Number(datePart.slice(4, 6));
        const day = Number(datePart.slice(6, 8));

        if (!isValidDateParts(year, month, day)) return null;

        const hour = Number(timePart.slice(0, 2) || "0");
        const minute = Number(timePart.slice(2, 4) || "0");
        const second = Number(timePart.slice(4, 6) || "0");
        const parsed = new Date(year, month - 1, day, hour, minute, second).getTime();
        return Number.isNaN(parsed) ? null : parsed;
    }

    // Day-first formatted strings: DD-MM-YYYY HH:mm or DD/MM/YYYY HH:mm
    const dayFirstMatch = trimmedValue.match(
        /^(\d{2})[/-](\d{2})[/-](\d{4})(?:,?\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (dayFirstMatch) {
        const day = Number(dayFirstMatch[1]);
        const month = Number(dayFirstMatch[2]);
        const year = Number(dayFirstMatch[3]);
        const hour = Number(dayFirstMatch[4] || "0");
        const minute = Number(dayFirstMatch[5] || "0");
        const second = Number(dayFirstMatch[6] || "0");

        if (!isValidDateParts(year, month, day)) return null;

        const parsed = new Date(year, month - 1, day, hour, minute, second).getTime();
        return Number.isNaN(parsed) ? null : parsed;
    }

    const parsed = Date.parse(trimmedValue);
    return Number.isNaN(parsed) ? null : parsed;
};

const getValueForDateSort = <TData,>(row: Row<TData>, columnId: string): unknown => {
    const original = (row.original || {}) as Record<string, any>;

    if (Object.prototype.hasOwnProperty.call(original, columnId)) {
        return original[columnId];
    }

    if (columnId === "study_date_time") {
        const caseDate = original.case_date;
        const caseTime = original.case_time;
        if (caseDate || caseTime) {
            return `${caseDate || ""} ${caseTime || ""}`.trim();
        }
    }

    if (columnId === "history_date_time") {
        return original.history_date_time || original.updatedAt || null;
    }

    if (columnId === "reporting_date_time") {
        return original.reporting_date_time || original.attached_report?.created_at || null;
    }

    return row.getValue(columnId);
};

const dateLikeSortingFn: SortingFn<any> = (rowA, rowB, columnId) => {
    const valueA = getValueForDateSort(rowA, columnId);
    const valueB = getValueForDateSort(rowB, columnId);

    const timestampA = parseDateLikeValue(valueA);
    const timestampB = parseDateLikeValue(valueB);

    if (timestampA === null && timestampB === null) {
        return String(valueA || "").localeCompare(String(valueB || ""));
    }
    if (timestampA === null) return 1;
    if (timestampB === null) return -1;
    return timestampA - timestampB;
};

const isDateLikeColumn = <TData,>(column: ColumnDef<TData, any>): boolean => {
    const columnDef = column as any;
    const header = typeof columnDef.header === "string" ? columnDef.header : "";
    const identifier = `${String(columnDef.id || "")} ${String(columnDef.accessorKey || "")} ${header}`.toLowerCase();
    return DATE_COLUMN_KEYWORDS.some((keyword) => identifier.includes(keyword));
};

const enhanceColumnsWithDateSorting = <TData,>(inputColumns: ColumnDef<TData, any>[]): ColumnDef<TData, any>[] => {
    return inputColumns.map((column) => {
        const nextColumn = { ...column } as any;

        if (Array.isArray(nextColumn.columns)) {
            nextColumn.columns = enhanceColumnsWithDateSorting(nextColumn.columns);
        }

        if (nextColumn.enableSorting === false || nextColumn.sortingFn) {
            return nextColumn;
        }

        if (isDateLikeColumn(nextColumn)) {
            nextColumn.sortingFn = dateLikeSortingFn;
        }

        return nextColumn;
    });
};

export interface DataTableProps<TData> {
    data: TData[];
    columns: ColumnDef<TData, any>[];
    isLoading?: boolean;
    error?: string | null;
    emptyMessage?: string;
    loadingMessage?: string;
    columnVisibility?: VisibilityState;
    onColumnVisibilityChange?: (visibility: VisibilityState) => void;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: (selection: RowSelectionState) => void;
    onRowClick?: (row: TData) => void;
    rowClassName?: string | ((row: TData) => string);
    headerClassName?: string;
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enableRowSelection?: boolean;
    showBorder?: boolean;
    containerClassName?: string;
    showColumnToggle?: boolean;
    tableTitle?: string;
    manualPagination?: boolean;
    showDoctorsOnSelect?: boolean;
    showEmptyTable?: boolean;
    tableDescription?: string;
    isColumnModalOpen?: boolean;
    onColumnModalOpenChange?: (open: boolean) => void;
    columnSizing?: ColumnSizingState;
    onColumnSizingChange?: (sizing: ColumnSizingState) => void;
    enableColumnResizing?: boolean;
    enablePagination?: boolean;
    pageSizeOptions?: number[];
    defaultPageSize?: number;
    manualPageIndex?: number;
    manualPageSize?: number;
    manualTotalRows?: number;
    manualTotalPages?: number;
    manualHasNextPage?: boolean;
    manualHasPreviousPage?: boolean;
    onManualPageChange?: (pageIndex: number) => void;
    onManualPageSizeChange?: (pageSize: number) => void;
    showTotalCount?: boolean;
    // onRefresh?: () => void | Promise<void>;
}

export function DataTable<TData>({
    data,
    columns,
    isLoading = false,
    error = null,
    emptyMessage = "No data available.",
    columnVisibility,
    onColumnVisibilityChange,
    rowSelection,
    onRowSelectionChange,
    onRowClick,
    rowClassName = "",
    headerClassName = "bg-muted/50",
    enableSorting = true,
    enableFiltering = true,
    enableRowSelection = false,
    showBorder = true,
    containerClassName = "flex flex-col gap-1 bg-white",
    showColumnToggle = true,
    tableTitle,
    manualPagination = false,
    showDoctorsOnSelect = false,
    showEmptyTable = false,
    tableDescription = "",
    isColumnModalOpen: externalIsColumnModalOpen,
    onColumnModalOpenChange: externalOnColumnModalOpenChange,
    columnSizing: externalColumnSizing,
    onColumnSizingChange: externalOnColumnSizingChange,
    enableColumnResizing = false,
    enablePagination = true,
    pageSizeOptions = [10, 20, 50, 100],
    defaultPageSize = 20,
    manualPageIndex = 0,
    manualPageSize,
    manualTotalRows,
    manualTotalPages,
    manualHasNextPage,
    manualHasPreviousPage,
    onManualPageChange,
    onManualPageSizeChange,
    showTotalCount = true,
    // onRefresh,
}: DataTableProps<TData>) {
    const { toast } = useToast();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [internalIsColumnModalOpen, setInternalIsColumnModalOpen] = useState(false);
    const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: defaultPageSize,
    });
    
    // Use external state if provided, otherwise use internal state
    const isColumnModalOpen = externalIsColumnModalOpen ?? internalIsColumnModalOpen;
    const setIsColumnModalOpen = externalOnColumnModalOpenChange ?? setInternalIsColumnModalOpen;
    // const [isRefreshing, setIsRefreshing] = useState(false);
    const columnsWithDateSorting = useMemo(
        () => enhanceColumnsWithDateSorting(columns),
        [columns]
    );
    const normalizedPageSizeOptions = useMemo(() => {
        const validOptions = [...pageSizeOptions, defaultPageSize, manualPageSize ?? defaultPageSize]
            .filter((size) => Number.isFinite(size) && size > 0);
        if (validOptions.length === 0) {
            return [defaultPageSize];
        }
        return Array.from(new Set(validOptions)).sort((a, b) => a - b);
    }, [defaultPageSize, manualPageSize, pageSizeOptions]);
    const isClientPaginationEnabled = enablePagination && !manualPagination;
    const isManualPaginationEnabled = enablePagination && manualPagination;
    const safeManualPageSize = Math.max(manualPageSize ?? defaultPageSize, 1);
    const safeManualPageIndex = Math.max(manualPageIndex, 0);
    const safeManualTotalRows = Math.max(manualTotalRows ?? data.length, 0);
    const computedManualTotalPages = Math.max(
        manualTotalPages ?? Math.ceil(safeManualTotalRows / safeManualPageSize),
        1
    );

    const table = useReactTable({
        data,
        columns: columnsWithDateSorting,
        state: {
            columnVisibility,
            sorting: enableSorting ? sorting : undefined,
            columnFilters: enableFiltering ? columnFilters : undefined,
            rowSelection: enableRowSelection ? rowSelection : undefined,
            ...(enableColumnResizing && externalColumnSizing ? { columnSizing: externalColumnSizing } : {}),
            ...(isClientPaginationEnabled ? { pagination } : {}),
        },
        onColumnVisibilityChange: (updater) => {
            if (onColumnVisibilityChange) {
                const newVisibility = typeof updater === 'function'
                    ? updater(columnVisibility || {})
                    : updater;
                onColumnVisibilityChange(newVisibility);
            }
        },
        onSortingChange: enableSorting ? setSorting : undefined,
        onColumnFiltersChange: enableFiltering ? setColumnFilters : undefined,
        onRowSelectionChange: enableRowSelection && onRowSelectionChange ? (updater) => onRowSelectionChange(updater as RowSelectionState) : undefined,
        onPaginationChange: isClientPaginationEnabled ? setPagination : undefined,
        enableRowSelection: enableRowSelection,
        enableColumnResizing,
        columnResizeMode: 'onChange',
        onColumnSizingChange: enableColumnResizing && externalOnColumnSizingChange
            ? (updater) => {
                const newSizing = typeof updater === 'function'
                    ? updater(externalColumnSizing || {})
                    : updater;
                externalOnColumnSizingChange(newSizing);
            }
            : undefined,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
        getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
        getPaginationRowModel: isClientPaginationEnabled ? getPaginationRowModel() : undefined,
        manualPagination,
    });

    useEffect(() => {
        if (!isClientPaginationEnabled) return;
        setPagination((prev) => {
            if (prev.pageSize === defaultPageSize && prev.pageIndex === 0) return prev;
            return { pageIndex: 0, pageSize: defaultPageSize };
        });
    }, [defaultPageSize, isClientPaginationEnabled]);

    useEffect(() => {
        if (!isClientPaginationEnabled) return;
        const maxPageIndex = Math.max(0, Math.ceil(data.length / pagination.pageSize) - 1);
        if (pagination.pageIndex > maxPageIndex) {
            setPagination((prev) => ({ ...prev, pageIndex: maxPageIndex }));
        }
    }, [data.length, isClientPaginationEnabled, pagination.pageIndex, pagination.pageSize]);

    // const handleRefresh = async () => {
    //     if (onRefresh && !isRefreshing) {
    //         setIsRefreshing(true);
    //         try {
    //             await onRefresh();
    //         } finally {
    //             setIsRefreshing(false);
    //         }
    //     }
    // };

    // Skeleton loading component - use default columns count when columns array is empty
    const skeletonColumnCount = columns.length > 0 ? columns.length : 8;

    const TableSkeleton = () => (
        <div className="overflow-hidden">
            <div className={showBorder ? "rounded-md border" : ""}>
                <Table className="w-full" style={{ tableLayout: 'fixed' }}>
                    <TableHeader>
                        <TableRow className={headerClassName}>
                            {[...Array(skeletonColumnCount)].map((_, index) => (
                                <TableHead
                                    key={index}
                                    className="font-semibold text-[11px] px-1 py-1"
                                    style={index === 0 ? { width: '32px' } : index === 1 ? { width: '140px' } : {}}
                                >
                                    <Skeleton className="h-3 w-16" />
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...Array(10)].map((_, rowIndex) => (
                            <TableRow key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                {[...Array(skeletonColumnCount)].map((_, colIndex) => (
                                    <TableCell key={colIndex} className="text-[11px] px-1 py-1">
                                        <Skeleton className="h-3 w-full max-w-25" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );

    // Loading state
    if (isLoading) {
        return (
            <div className={containerClassName}>
                {tableTitle && (
                    <div className="flex items-center justify-between py-1 px-1">
                        <div className="flex flex-col">
                            <p className="text-lg font-semibold">{tableTitle}</p>
                            {tableDescription && (
                                <p className="text-sm text-muted-foreground">{tableDescription}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            {(showColumnToggle && onColumnVisibilityChange) && (
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-8" disabled>
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8" disabled>
                                        <RotateCcwIcon className="h-4 w-4 animate-spin" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <TableSkeleton />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <p className="text-red-500 mb-2">Error: {error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    Retry
                </button>
            </div>
        );
    }

    // Empty state (only if showEmptyTable is false)
    if (data.length === 0 && !showEmptyTable) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    const getRowClassName = (row: TData): string => {
        if (typeof rowClassName === 'function') {
            return rowClassName(row);
        }
        return rowClassName;
    };

    const fetchAvailableDoctors = async () => {
        try {
            setIsLoadingDoctors(true);
            const response = await apiService.getAvailableDoctors() as DoctorResponse;
            if (response.success) {
                setAvailableDoctors(response.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch available doctors:', error);
        } finally {
            setIsLoadingDoctors(false);
        }
    };

    const handleAssignDoctor = async (doctorId: string) => {
        if (!rowSelection || Object.keys(rowSelection).length === 0) return;

        try {
            setIsAssigning(true);
            const selectedRowIndices = Object.keys(rowSelection).filter(
                key => rowSelection[key] === true
            );

            const selectedRows = selectedRowIndices.map(index =>
                data[parseInt(index)]
            );

            // Assign doctor to each selected case
            const assignPromises = selectedRows.map((row: any) => {
                const caseId = row._id;
                if (!caseId) {
                    console.warn('Row missing case_id (_id):', row);
                    return Promise.resolve();
                }
                return apiService.assignCaseToDoctor(caseId, doctorId);
            });

            await Promise.all(assignPromises);

            // Clear selection after successful assignment
            if (onRowSelectionChange) {
                onRowSelectionChange({});
            }

            setIsDropdownOpen(false);

            // Show success toast and reload
            toast({
                title: "Success",
                description: `Successfully assigned ${selectedRows.length} case(s) to doctor.`,
            });

            // Reload the page to reflect changes
            window.location.reload();
        } catch (error) {
            console.error('Failed to assign doctor:', error);
            toast({
                title: "Error",
                description: "Failed to assign doctor. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsAssigning(false);
        }
    };

    const showSettings = showColumnToggle && onColumnVisibilityChange;
    const selectedRowCount = rowSelection ? Object.keys(rowSelection).length : 0;
    const showDoctorsDropdown = showDoctorsOnSelect && selectedRowCount > 0;
    const prePaginationRowCount = table.getPrePaginationRowModel().rows.length;
    const currentRowsOnPage = table.getRowModel().rows.length;
    const clientPageIndex = table.getState().pagination?.pageIndex ?? 0;
    const clientPageSize = table.getState().pagination?.pageSize ?? defaultPageSize;
    const currentPage = isManualPaginationEnabled
        ? Math.min(safeManualPageIndex, computedManualTotalPages - 1)
        : clientPageIndex;
    const currentPageSize = isManualPaginationEnabled ? safeManualPageSize : clientPageSize;
    const totalRows = isManualPaginationEnabled ? safeManualTotalRows : prePaginationRowCount;
    const totalPages = isManualPaginationEnabled ? computedManualTotalPages : Math.max(table.getPageCount(), 1);
    const hasManualPageChange = typeof onManualPageChange === "function";
    const canPreviousPage = isManualPaginationEnabled
        ? hasManualPageChange && (manualHasPreviousPage ?? currentPage > 0)
        : table.getCanPreviousPage();
    const canNextPage = isManualPaginationEnabled
        ? hasManualPageChange && (manualHasNextPage ?? currentPage < totalPages - 1)
        : table.getCanNextPage();
    const shouldShowPaginationControls = enablePagination && totalRows > 0;
    const pageStart = totalRows === 0 ? 0 : currentPage * currentPageSize + 1;
    const pageEnd = totalRows === 0
        ? 0
        : Math.min((currentPage * currentPageSize) + currentRowsOnPage, totalRows);
    const selectedCasesLabel = `${selectedRowCount} case${selectedRowCount === 1 ? "" : "s"} selected`;

    const handlePreviousPage = () => {
        if (!canPreviousPage) return;
        if (isManualPaginationEnabled) {
            onManualPageChange?.(Math.max(currentPage - 1, 0));
            return;
        }
        table.previousPage();
    };

    const handleNextPage = () => {
        if (!canNextPage) return;
        if (isManualPaginationEnabled) {
            onManualPageChange?.(Math.min(currentPage + 1, totalPages - 1));
            return;
        }
        table.nextPage();
    };

    const handlePageSizeChange = (value: string) => {
        const nextSize = Number(value);
        if (!Number.isFinite(nextSize) || nextSize <= 0) return;
        if (isManualPaginationEnabled) {
            onManualPageSizeChange?.(nextSize);
            onManualPageChange?.(0);
            return;
        }
        table.setPageSize(nextSize);
        table.setPageIndex(0);
    };

    const handleClearSelection = () => {
        onRowSelectionChange?.({});
    };

    const assignDoctorDropdown = (
        <DropdownMenu
            open={isDropdownOpen}
            onOpenChange={(open) => {
                setIsDropdownOpen(open);
                if (open) {
                    fetchAvailableDoctors();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="default"
                    size="sm"
                    className="h-8 w-[11.5rem] justify-between gap-2"
                    disabled={isAssigning}
                >
                    {isAssigning ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Assigning...
                        </>
                    ) : (
                        <>
                            <UserPlus className="h-4 w-4" />
                            Assign Doctor
                            <ChevronDown className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="w-[min(22rem,calc(100vw-2rem))] min-w-[18rem]"
            >
                {isLoadingDoctors ? (
                    <DropdownMenuItem disabled>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Loading doctors...
                    </DropdownMenuItem>
                ) : availableDoctors.length === 0 ? (
                    <DropdownMenuItem disabled>
                        No doctors available
                    </DropdownMenuItem>
                ) : (
                    availableDoctors.map((doctor) => (
                        <DropdownMenuItem
                            key={doctor._id}
                            onClick={() => handleAssignDoctor(doctor._id)}
                            disabled={isAssigning}
                            className="flex flex-col items-start gap-0"
                        >
                            <div className="text-sm font-medium">
                                {doctor.full_name}
                            </div>
                            <p className="text-xs text-muted-foreground">{doctor.email}</p>
                        </DropdownMenuItem>
                    ))
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className={containerClassName}>
            {(tableTitle || tableDescription) && (
                <div className="flex items-center justify-between py-1 px-1">
                    <div className="flex items-center gap-2">
                        {tableTitle && (
                            <p className="text-base font-semibold">{tableTitle}</p>
                        )}
                    </div>
                    {tableDescription && (
                        <p className="text-xs text-muted-foreground">{tableDescription}</p>
                    )}
                </div>
            )}
            {showDoctorsDropdown && (
                <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs font-medium text-slate-700 sm:text-sm">
                            {selectedCasesLabel}
                        </p>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            {assignDoctorDropdown}
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-xs text-slate-700 hover:text-slate-900"
                                onClick={handleClearSelection}
                                disabled={isAssigning}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="overflow-hidden">
                <div className={showBorder ? "rounded-md border" : ""}>
                    <Table className="w-full" style={{ tableLayout: 'fixed' }}>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className={headerClassName}>
                                    {headerGroup.headers.map((header) => {
                                        const isSelectCol = header.id === 'select';
                                        const isActionsCol = header.id === 'actions';
                                        const isNameCol = header.id === 'name';
                                        const isFixedCol = isSelectCol || isActionsCol || isNameCol;

                                        // Set specific widths for fixed columns, or use column size when resizing is enabled
                                        const colStyle: React.CSSProperties = enableColumnResizing
                                            ? { width: header.getSize(), position: 'relative' }
                                            : isSelectCol
                                                ? { width: '32px' }
                                                : isActionsCol
                                                    ? { width: '140px' }
                                                    : isNameCol
                                                        ? { width: '180px' }
                                                        : {};

                                        return (
                                            <TableHead
                                                key={header.id}
                                                style={colStyle}
                                                className="font-semibold text-[11px] px-1 py-1 whitespace-nowrap"
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <div
                                                        className={
                                                            header.column.getCanSort()
                                                                ? `flex items-center gap-0.5 cursor-pointer select-none hover:text-gray-900 ${isFixedCol ? '' : 'truncate'}`
                                                                : isFixedCol ? '' : 'truncate'
                                                        }
                                                        onClick={header.column.getToggleSortingHandler()}
                                                    >
                                                        <span className={isFixedCol ? '' : 'truncate'}>
                                                            {flexRender(
                                                                header.column.columnDef.header,
                                                                header.getContext()
                                                            )}
                                                        </span>
                                                        {header.column.getCanSort() && (
                                                            <span className="shrink-0 ml-0.5">
                                                                {header.column.getIsSorted() === 'asc' ? (
                                                                    <ArrowUp className="h-3 w-3" />
                                                                ) : header.column.getIsSorted() === 'desc' ? (
                                                                    <ArrowDown className="h-3 w-3" />
                                                                ) : (
                                                                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {enableColumnResizing && header.column.getCanResize() && (
                                                    <div
                                                        onMouseDown={header.getResizeHandler()}
                                                        onTouchStart={header.getResizeHandler()}
                                                        onDoubleClick={() => header.column.resetSize()}
                                                        className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none hover:bg-blue-500 ${header.column.getIsResizing() ? 'bg-blue-600' : 'bg-transparent'}`}
                                                    />
                                                )}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length > 0 ? (
                                table.getRowModel().rows.map((row, index) => (
                                    <TableRow
                                        key={row.id}
                                        className={`${index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/70 hover:bg-slate-100/70'
                                            } ${onRowClick ? 'cursor-pointer' : ''} ${getRowClassName(row.original)}`}
                                        onClick={() => onRowClick?.(row.original)}
                                        data-state={enableRowSelection && row.getIsSelected() ? "selected" : undefined}
                                    >
                                        {row.getVisibleCells().map((cell) => {
                                            return (
                                                <TableCell
                                                    key={cell.id}
                                                    className="text-[11px] px-1 py-1 max-w-0"
                                                    style={enableColumnResizing ? { width: cell.column.getSize() } : undefined}
                                                >
                                                    <div className="truncate" title={String(cell.getValue() ?? '')}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </div>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-gray-500"
                                    >
                                        {emptyMessage}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            {shouldShowPaginationControls && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2 py-3">
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground">Rows per page</p>
                        <Select
                            value={`${currentPageSize}`}
                            onValueChange={handlePageSizeChange}
                        >
                            <SelectTrigger className="h-7 w-16 text-xs">
                                <SelectValue placeholder={`${currentPageSize}`} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {normalizedPageSizeOptions.map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {showTotalCount && (
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                                Showing {pageStart}-{pageEnd} of {totalRows}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                            Page {currentPage + 1} of {totalPages}
                        </p>
                        <Pagination className="mx-0 w-auto justify-start">
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handlePreviousPage();
                                        }}
                                        className={
                                            !canPreviousPage
                                                ? "pointer-events-none opacity-50"
                                                : "cursor-pointer"
                                        }
                                    />
                                </PaginationItem>
                                <PaginationItem>
                                    <PaginationNext
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleNextPage();
                                        }}
                                        className={
                                            !canNextPage
                                                ? "pointer-events-none opacity-50"
                                                : "cursor-pointer"
                                        }
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    </div>
                </div>
            )}
            {showSettings && (
                <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
                    <DialogContent className="sm:max-w-106.25">
                        <DialogHeader>
                            <DialogTitle>Toggle Columns</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1 py-4">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    const columnName = typeof column.columnDef.header === 'string'
                                        ? column.columnDef.header
                                        : column.id;

                                    return (
                                        <div
                                            key={column.id}
                                            className="flex items-center justify-between space-x-2"
                                        >
                                            <Label
                                                htmlFor={column.id}
                                                className="text-xs font-normal capitalize cursor-pointer"
                                            >
                                                {columnName}
                                            </Label>
                                            <Switch
                                                id={column.id}
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) => {
                                                    const newVisibility = {
                                                        ...columnVisibility,
                                                        [column.id]: value,
                                                    };
                                                    onColumnVisibilityChange?.(newVisibility);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
