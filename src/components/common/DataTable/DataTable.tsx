import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { flexRender, useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import type { ColumnDef, VisibilityState, SortingState, ColumnFiltersState, RowSelectionState, ColumnSizingState } from '@tanstack/react-table';
import { Loader2, RotateCcwIcon, Settings, UserPlus, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";
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
    rowClassName = "hover:bg-muted/30 cursor-pointer",
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
    // onRefresh,
}: DataTableProps<TData>) {
    console.log('=== DataTable Render ===');
    console.log('Data received:', data);
    console.log('Data length:', data?.length);
    console.log('Columns:', columns);
    console.log('isLoading:', isLoading);
    console.log('error:', error);
    
    const { toast } = useToast();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [internalIsColumnModalOpen, setInternalIsColumnModalOpen] = useState(false);
    const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // Use external state if provided, otherwise use internal state
    const isColumnModalOpen = externalIsColumnModalOpen ?? internalIsColumnModalOpen;
    const setIsColumnModalOpen = externalOnColumnModalOpenChange ?? setInternalIsColumnModalOpen;
    // const [isRefreshing, setIsRefreshing] = useState(false);

    const table = useReactTable({
        data,
        columns,
        state: {
            columnVisibility,
            sorting: enableSorting ? sorting : undefined,
            columnFilters: enableFiltering ? columnFilters : undefined,
            rowSelection: enableRowSelection ? rowSelection : undefined,
            ...(enableColumnResizing && externalColumnSizing ? { columnSizing: externalColumnSizing } : {}),
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
        manualPagination,
    });

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
                            <TableRow key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-green-100/30' : 'bg-blue-100/30'}>
                                {[...Array(skeletonColumnCount)].map((_, colIndex) => (
                                    <TableCell key={colIndex} className="text-[11px] px-1 py-1">
                                        <Skeleton className="h-3 w-full max-w-[100px]" />
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

    return (
        <div className={containerClassName}>
            {(tableTitle || showDoctorsDropdown) && (
                <div className="flex items-center justify-between py-1 px-1">
                    <div className="flex items-center gap-2">
                        {tableTitle && (
                            <p className="text-base font-semibold">{tableTitle}</p>
                        )}
                    </div>
                    {tableDescription && (
                        <p className="text-xs text-muted-foreground">{tableDescription}</p>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                        {showDoctorsDropdown && (
                            <DropdownMenu open={isDropdownOpen} onOpenChange={(open) => {
                                setIsDropdownOpen(open);
                                if (open) {
                                    fetchAvailableDoctors();
                                }
                            }}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="h-8 gap-2"
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
                                <DropdownMenuContent align="end" className="w-56">
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
                        )}
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
                                                            <span className="flex-shrink-0 ml-0.5">
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
                                        className={`${getRowClassName(row.original)} ${index % 2 === 0 ? 'bg-green-100/50 hover:bg-green-100/70' : 'bg-blue-100/50 hover:bg-blue-100/70'
                                            }`}
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
