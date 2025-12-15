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
import { Calendar, Filter, RotateCcw, Search, SlidersHorizontal, User } from "lucide-react";
import { useMemo, useState, useEffect } from "react";

export interface FilterState {
    patientName: string;
    patientId: string;
    bodyPart: string;
    hospital: string;
    startDate: string;
    endDate: string;
    status: string; // 'all', 'assigned', 'unassigned'
    gender: {
        M: boolean;
        F: boolean;
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
}

const FilterPanel = ({
    onFilterChange,
    onFilterReset,
    activePeriod = '1D',
    setActivePeriod,
    initialFilters,
}: FilterPanelProps) => {
    const [filters, setFilters] = useState<FilterState>({
        patientName: '',
        patientId: '',
        bodyPart: '',
        hospital: '',
        startDate: '',
        endDate: '',
        status: 'all',
        gender: { M: false, F: false },
        modalities: {
            ALL: false, DT: false, SC: false, AN: false,
            US: false, ECHO: false, CR: false, XA: false,
            MR: false, CTMR: false, PX: false, DX: false,
            MR2: false, NM: false, RF: false, CT: false,
        },
        ...initialFilters,
    });

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
            filters.hospital !== '' ||
            filters.startDate !== '' ||
            filters.endDate !== '';

        const hasGenderFilter = filters.gender.M || filters.gender.F;

        const hasModalityFilter = Object.values(filters.modalities).some(v => v);

        return hasTextFilters || hasGenderFilter || hasModalityFilter;
    }, [filters]);

    const handleResetFilters = () => {
        const resetFilters: FilterState = {
            patientName: '',
            patientId: '',
            bodyPart: '',
            hospital: '',
            startDate: '',
            endDate: '',
            status: 'all',
            gender: { M: false, F: false },
            modalities: {
                ALL: false, DT: false, SC: false, AN: false,
                US: false, ECHO: false, CR: false, XA: false,
                MR: false, CTMR: false, PX: false, DX: false,
                MR2: false, NM: false, RF: false, CT: false,
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
                                Body Part
                            </label>
                            <Input
                                placeholder="Enter body part"
                                value={filters.bodyPart}
                                onChange={(e) => setFilters({ ...filters, bodyPart: e.target.value })}
                                className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Gender
                            </label>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={() => setFilters({ ...filters, gender: { ...filters.gender, M: !filters.gender.M } })}
                                    className={`
                                        flex-1 h-8 rounded-md font-semibold text-xs transition-all duration-200 border
                                        ${filters.gender.M
                                            ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    Male
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, gender: { ...filters.gender, F: !filters.gender.F } })}
                                    className={`
                                        flex-1 h-8 rounded-md font-semibold text-xs transition-all duration-200 border
                                        ${filters.gender.F
                                            ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    Female
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Hospital
                            </label>
                            <Select
                                value={filters.hospital}
                                onValueChange={(value) => setFilters({ ...filters, hospital: value })}
                            >
                                <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                    <SelectValue placeholder="Select Hospital..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hospital_a" className="text-xs">Hospital A</SelectItem>
                                    <SelectItem value="hospital_b" className="text-xs">Hospital B</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                Case Status
                            </label>
                            <Select
                                value={filters.status}
                                onValueChange={(value) => setFilters({ ...filters, status: value })}
                            >
                                <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                    <SelectValue placeholder="All Cases" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="text-xs">All Cases</SelectItem>
                                    <SelectItem value="assigned" className="text-xs">Assigned</SelectItem>
                                    <SelectItem value="unassigned" className="text-xs">Unassigned</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                <Calendar className="w-3 h-3" />
                                From Date
                            </label>
                            <Input
                                type="date"
                                value={filters.startDate}
                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                            />
                            {setActivePeriod && (
                                <div className="flex gap-1 mt-1">
                                    {['1D', '2D', '3D', '1W', '2W'].map((period) => (
                                        <button
                                            key={period}
                                            onClick={() => setActivePeriod(period)}
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
                            <Input
                                type="date"
                                value={filters.endDate}
                                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                                className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                            />
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
                                    onCheckedChange={(checked) =>
                                        setFilters({
                                            ...filters,
                                            modalities: { ...filters.modalities, [mod]: checked as boolean },
                                        })
                                    }
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
