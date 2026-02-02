import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Calendar, Filter, RotateCcw, Search, SlidersHorizontal, User, ChevronDown } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";

export interface FilterState {
    patientName: string;
    patientId: string;
    bodyPart: string;
    startDate: string;
    endDate: string;
    status: string; // 'all', 'assigned', 'unassigned'
    gender: {
        M: boolean;
        F: boolean;
    };
    hospital: string;
    centers?: string[]; // Multi-select centers
    studyStatus?: {
        reported: boolean;
        drafted: boolean;
        unreported: boolean;
        reviewed: boolean;
    };
    reportStatus: {
        reported: boolean;
        drafted: boolean;
        unreported: boolean;
    };
    modalities: {
        ALL: boolean;
        DT: boolean;
        SC: boolean;
        AN: boolean;
        US: boolean;
        ECHO: boolean;
        CR: boolean;
        XA: boolean;
        MR: boolean;
        CTMR: boolean;
        PX: boolean;
        DX: boolean;
        MR2: boolean;
        NM: boolean;
        RF: boolean;
        CT: boolean;
    };
}

interface FilterPanelProps {
    onFilterChange?: (filters: FilterState) => void;
    onFilterReset?: () => void;
    activePeriod?: string;
    setActivePeriod?: (period: string) => void;
    initialFilters?: Partial<FilterState>;
    availableCenters?: { id: string; name: string }[];
    showCenters?: boolean;
    showStudyStatus?: boolean;
}

// Format date as YYYY-MM-DD for input[type="date"]
const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper function to get start date based on period
const getStartDateFromPeriod = (period: string): string => {
    const today = new Date();
    const startDate = new Date(today);

    switch (period) {
        case '1D':
            startDate.setDate(today.getDate() - 1);
            break;
        case '2D':
            startDate.setDate(today.getDate() - 2);
            break;
        case '3D':
            startDate.setDate(today.getDate() - 3);
            break;
        case '1W':
            startDate.setDate(today.getDate() - 7);
            break;
        case '2W':
            startDate.setDate(today.getDate() - 14);
            break;
        case '1M':
            startDate.setDate(today.getDate() - 30);
            break;
        default:
            startDate.setDate(today.getDate() - 30); // Default to 1M (30 days)
    }

    return formatDate(startDate);
};

// Helper function to get default date range (30 days = 1M)
const getDefaultDateRange = () => {
    const today = new Date();
    return {
        startDate: getStartDateFromPeriod('1M'),
        endDate: formatDate(today),
    };
};

const FilterPanel = ({
    onFilterChange,
    onFilterReset,
    activePeriod = '1M',
    setActivePeriod,
    initialFilters,
    availableCenters = [],
    showCenters = false,
    showStudyStatus = false,
}: FilterPanelProps) => {
    const defaultDates = getDefaultDateRange();

    const [filters, setFilters] = useState<FilterState>({
        patientName: '',
        patientId: '',
        bodyPart: '',
        startDate: defaultDates.startDate,
        endDate: defaultDates.endDate,
        status: 'all',
        gender: { M: false, F: false },
        hospital: '',
        centers: [],
        studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
        reportStatus: { reported: false, drafted: false, unreported: false },
        modalities: {
            ALL: true, DT: true, SC: true, AN: true,
            US: true, ECHO: true, CR: true, XA: true,
            MR: true, CTMR: true, PX: true, DX: true,
            MR2: true, NM: true, RF: true, CT: true,
        },
        ...initialFilters,
    });

    // Refs for date inputs to trigger calendar popup
    const fromDateRef = useRef<HTMLInputElement>(null);
    const toDateRef = useRef<HTMLInputElement>(null);

    // Sync filters when initialFilters change
    useEffect(() => {
        if (initialFilters) {
            setFilters((prev) => ({
                ...prev,
                ...initialFilters,
            }));
        }
    }, [initialFilters]);

    // Check if any filter is applied
    const isAnyFilterApplied = useMemo(() => {
        const hasTextFilters =
            filters.patientName !== '' ||
            filters.patientId !== '' ||
            filters.bodyPart !== '' ||
            filters.startDate !== '' ||
            filters.endDate !== '';

        const hasGenderFilter = filters.gender.M || filters.gender.F;

        const hasReportStatusFilter = filters.reportStatus.reported || filters.reportStatus.drafted || filters.reportStatus.unreported;

        const hasStudyStatusFilter = filters.studyStatus?.reported || filters.studyStatus?.drafted || filters.studyStatus?.unreported || filters.studyStatus?.reviewed;

        const hasCentersFilter = filters.centers && filters.centers.length > 0;

        const hasModalityFilter = Object.values(filters.modalities).some(v => v);

        return hasTextFilters || hasGenderFilter || hasReportStatusFilter || hasStudyStatusFilter || hasCentersFilter || hasModalityFilter;
    }, [filters]);

    const handleResetFilters = () => {
        const resetFilters: FilterState = {
            patientName: '',
            patientId: '',
            bodyPart: '',
            startDate: '',
            endDate: '',
            status: 'all',
            gender: { M: false, F: false },
            hospital: '',
            centers: [],
            studyStatus: { reported: false, drafted: false, unreported: false, reviewed: false },
            reportStatus: { reported: false, drafted: false, unreported: false },
            modalities: {
                ALL: true, DT: true, SC: true, AN: true,
                US: true, ECHO: true, CR: true, XA: true,
                MR: true, CTMR: true, PX: true, DX: true,
                MR2: true, NM: true, RF: true, CT: true,
            },
        };
        setFilters(resetFilters);
        onFilterReset?.();
    };

    return (
        <div className="px-4 py-3 bg-slate-50/50">
            <div className="flex gap-5">
                {/* Left Section - Inputs */}
                <div className="flex-1 space-y-3">
                    {/* Row 1 */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                <User className="w-3 h-3" />
                                Patient Name
                            </label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <Input
                                    placeholder="Search patient..."
                                    value={filters.patientName}
                                    onChange={(e) => setFilters({ ...filters, patientName: e.target.value })}
                                    className="pl-8 bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Patient ID
                            </label>
                            <Input
                                placeholder="Enter ID"
                                value={filters.patientId}
                                onChange={(e) => setFilters({ ...filters, patientId: e.target.value })}
                                className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Study Description
                            </label>
                            <Input
                                placeholder="Enter study description"
                                value={filters.bodyPart}
                                onChange={(e) => setFilters({ ...filters, bodyPart: e.target.value })}
                                className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Gender
                            </label>
                            <Select
                                value={
                                    filters.gender.M && filters.gender.F ? 'all' :
                                        filters.gender.M ? 'M' :
                                            filters.gender.F ? 'F' : 'all'
                                }
                                onValueChange={(value) => {
                                    if (value === 'all') {
                                        setFilters({ ...filters, gender: { M: false, F: false } });
                                    } else if (value === 'M') {
                                        setFilters({ ...filters, gender: { M: true, F: false } });
                                    } else if (value === 'F') {
                                        setFilters({ ...filters, gender: { M: false, F: true } });
                                    }
                                }}
                            >
                                <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all">
                                    <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="M">Male</SelectItem>
                                    <SelectItem value="F">Female</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2 - Center and Study Status (conditional) */}
                    {(showCenters || showStudyStatus) && (
                        <div className="grid grid-cols-4 gap-3">
                            {showCenters && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        Center
                                    </label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between h-8 text-xs font-normal bg-white border-slate-200 hover:bg-slate-50"
                                            >
                                                <span className="truncate">
                                                    {filters.centers && filters.centers.length > 0
                                                        ? `${filters.centers.length} selected`
                                                        : 'Select centers'}
                                                </span>
                                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[250px] p-0" align="start">
                                            <div className="max-h-[200px] overflow-y-auto p-2">
                                                {availableCenters.map(center => (
                                                    <label key={center.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded cursor-pointer">
                                                        <Checkbox
                                                            checked={filters.centers?.includes(center.id)}
                                                            onCheckedChange={(checked) => {
                                                                const currentCenters = filters.centers || [];
                                                                if (checked) {
                                                                    setFilters({ ...filters, centers: [...currentCenters, center.id] });
                                                                } else {
                                                                    setFilters({ ...filters, centers: currentCenters.filter(c => c !== center.id) });
                                                                }
                                                            }}
                                                            className="h-3.5 w-3.5"
                                                        />
                                                        <span className="text-xs text-slate-700">{center.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                            {showStudyStatus && (
                                <div className="space-y-1">
                                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                        Study Status
                                    </label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="w-full justify-between h-8 text-xs font-normal bg-white border-slate-200 hover:bg-slate-50"
                                            >
                                                <span className="truncate">
                                                    {filters.studyStatus && Object.values(filters.studyStatus).some(v => v)
                                                        ? `${Object.values(filters.studyStatus).filter(v => v).length} selected`
                                                        : 'Select status'}
                                                </span>
                                                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[200px] p-0" align="start">
                                            <div className="p-2 space-y-1">
                                                {[
                                                    { key: 'reported', label: 'Reported' },
                                                    { key: 'drafted', label: 'Drafted' },
                                                    { key: 'unreported', label: 'Unreported' },
                                                    { key: 'reviewed', label: 'Reviewed' }
                                                ].map(({ key, label }) => (
                                                    <label key={key} className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded cursor-pointer">
                                                        <Checkbox
                                                            checked={!!filters.studyStatus?.[key as keyof typeof filters.studyStatus]}
                                                            onCheckedChange={(checked) => {
                                                                setFilters({
                                                                    ...filters,
                                                                    studyStatus: {
                                                                        ...(filters.studyStatus ?? {
                                                                            reported: false,
                                                                            drafted: false,
                                                                            unreported: false,
                                                                            reviewed: false,
                                                                        }),
                                                                        [key]: checked as boolean
                                                                    }
                                                                });
                                                            }}
                                                            className="h-3.5 w-3.5"
                                                        />
                                                        <span className="text-xs text-slate-700">{label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Row 3 - Date Range */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                <Calendar className="w-3 h-3" />
                                From Date
                            </label>
                            <div className="relative">
                                <Input
                                    ref={fromDateRef}
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all pr-8"
                                />
                                <button
                                    type="button"
                                    onClick={() => fromDateRef.current?.showPicker()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <Calendar className="w-4 h-4" />
                                </button>
                            </div>
                            {setActivePeriod && (
                                <div className="flex gap-1 mt-1">
                                    {['1D', '2D', '3D', '1W', '2W', '1M'].map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => {
                                                setActivePeriod(period);
                                                const newStartDate = getStartDateFromPeriod(period);
                                                setFilters(prev => ({ ...prev, startDate: newStartDate }));
                                            }}
                                            className={`
                                                px-2 py-0.5 rounded text-[10px] font-bold transition-all duration-200
                                                ${activePeriod === period
                                                    ? 'bg-slate-700 text-white'
                                                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                                                }
                                            `}
                                        >
                                            {period}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                <Calendar className="w-3 h-3" />
                                To Date
                            </label>
                            <div className="relative">
                                <Input
                                    ref={toDateRef}
                                    type="date"
                                    value={filters.endDate}
                                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                    className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all pr-8"
                                />
                                <button
                                    type="button"
                                    onClick={() => toDateRef.current?.showPicker()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <Calendar className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end gap-1.5">
                            <Button
                                onClick={() => onFilterChange?.(filters)}
                                className="flex-1 bg-slate-800 hover:bg-slate-900 h-8 text-xs font-semibold rounded-md shadow-sm hover:shadow transition-all duration-200"
                            >
                                <Filter className="w-3.5 h-3.5 mr-1.5" />
                                Apply
                            </Button>
                            <Button
                                onClick={handleResetFilters}
                                disabled={!isAnyFilterApplied}
                                variant="outline"
                                className="flex-1 h-8 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                                Reset
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Right Section - Modality */}
                <div className="w-[320px] border-l border-slate-200 pl-5">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        <SlidersHorizontal className="w-3 h-3" />
                        Modality
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                        {Object.keys(filters.modalities).map((mod) => (
                            <label
                                key={mod}
                                className={`
                                    flex items-center justify-center px-1.5 py-1.5 rounded-md cursor-pointer transition-all duration-200 border
                                    ${filters.modalities[mod as keyof typeof filters.modalities]
                                        ? 'bg-slate-700 border-slate-700 text-white'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }
                                `}
                            >
                                <Checkbox
                                    checked={filters.modalities[mod as keyof typeof filters.modalities]}
                                    onCheckedChange={(checked) => {
                                        if (mod === 'ALL') {
                                            // When ALL is clicked, select/deselect all modalities
                                            const newModalitiesState = Object.keys(filters.modalities).reduce(
                                                (acc, key) => ({ ...acc, [key]: checked as boolean }),
                                                {} as typeof filters.modalities
                                            );
                                            setFilters({
                                                ...filters,
                                                modalities: newModalitiesState,
                                            });
                                        } else {
                                            // When individual modality is clicked
                                            setFilters({
                                                ...filters,
                                                modalities: { ...filters.modalities, [mod]: checked as boolean },
                                            });
                                        }
                                    }}
                                    className="hidden"
                                />
                                <span className="text-[11px] font-bold">{mod}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FilterPanel;
