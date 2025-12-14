import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { flexRender, useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel } from "@tanstack/react-table";
import type { ColumnDef, VisibilityState, SortingState, ColumnFiltersState, RowSelectionState } from '@tanstack/react-table';
import { Loader2, RotateCcwIcon, Settings, UserPlus, ChevronDown } from "lucide-react";
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
}

export function DataTable<TData>({
    data,
    columns,
    isLoading = false,
    error = null,
    emptyMessage = "No data available.",
    loadingMessage = "Loading data...",
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
    containerClassName = "flex flex-col gap-2 bg-white",
    showColumnToggle = true,
    tableTitle,
    manualPagination = false,
    showDoctorsOnSelect = false,
}: DataTableProps<TData>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
    const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
    const [isAssigning, setIsAssigning] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false); 

    const table = useReactTable({
        data,
        columns,
        state: {
            columnVisibility,
            sorting: enableSorting ? sorting : undefined,
            columnFilters: enableFiltering ? columnFilters : undefined,
            rowSelection: enableRowSelection ? rowSelection : undefined,
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
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
        getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
        manualPagination,
    });

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-2 text-gray-600">{loadingMessage}</span>
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

    // Empty state
    if (data.length === 0) {
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
        } catch (error) {
            console.error('Failed to assign doctor:', error);
        } finally {
            setIsAssigning(false);
        }
    };

    const showSettings = showColumnToggle && onColumnVisibilityChange;
    const selectedRowCount = rowSelection ? Object.keys(rowSelection).length : 0;
    const showDoctorsDropdown = showDoctorsOnSelect && selectedRowCount > 0;

    return (
        <div className={containerClassName}>
            {(tableTitle || showSettings || showDoctorsDropdown) && (
                <div className="flex items-center justify-between py-2 px-1">
                    {tableTitle && (
                        <h3 className="text-lg font-semibold">{tableTitle}</h3>
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
                        {showSettings && (
                            <>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => setIsColumnModalOpen(true)}
                                    >
                                        <Settings className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8"
                                        onClick={() => setIsColumnModalOpen(true)}
                                    >
                                        <RotateCcwIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                                <Dialog open={isColumnModalOpen} onOpenChange={setIsColumnModalOpen}>
                                    <DialogContent className="sm:max-w-[425px]">
                                        <DialogHeader>
                                            <DialogTitle>Toggle Columns</DialogTitle>
                                        </DialogHeader>
                                        <div className="flex flex-col gap-4 py-4">
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
                                                                className="text-sm font-normal capitalize cursor-pointer"
                                                            >
                                                                {columnName}
                                                            </Label>
                                                            <Switch
                                                                id={column.id}
                                                                checked={column.getIsVisible()}
                                                                onCheckedChange={(checked) =>
                                                                    column.toggleVisibility(checked)
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </>
                        )}
                    </div>
                </div>
            )}
            <div className="overflow-x-auto">
                <div className={showBorder ? "rounded-md border" : ""}>
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className={headerClassName}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="font-semibold whitespace-nowrap text-xs px-2 py-2">
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    className={getRowClassName(row.original)}
                                    onClick={() => onRowClick?.(row.original)}
                                    data-state={enableRowSelection && row.getIsSelected() ? "selected" : undefined}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="whitespace-nowrap text-xs px-2 py-2">
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}
