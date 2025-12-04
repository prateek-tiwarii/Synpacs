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
import { Calendar, ChevronDown, ChevronUp, Filter, RotateCcw, Search, SlidersHorizontal, User } from "lucide-react";
import { useMemo, useState } from "react";

const DoctorDashboardHeader = ({
    activeTab,
    setActiveTab,
    isFilterCollapsed,
    setIsFilterCollapsed,
    onFilterChange,
    onFilterReset,
    setActivePeriod,
    activePeriod }
    : {
        activeTab: string,
        setActiveTab: any
        isFilterCollapsed: boolean,
        setIsFilterCollapsed: any,
        onFilterChange: any,
        onFilterReset: any,
        setActivePeriod: any,
        activePeriod: string
    }) => {

    const [filters, setFilters] = useState({
        patientName: '',
        patientId: '',
        bodyPart: '',
        hospital: '',
        startDate: '',
        endDate: '',
        gender: { M: false, F: false },
        modalities: {
            ALL: false, DT: false, SC: false, AN: false,
            US: false, ECHO: false, CR: false, XA: false,
            MR: false, CTMR: false, PX: false, DX: false,
            MR2: false, NM: false, RF: false, CT: false,
        },
    });

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
        setFilters({
            patientName: '',
            patientId: '',
            bodyPart: '',
            hospital: '',
            startDate: '',
            endDate: '',
            gender: { M: false, F: false },
            modalities: {
                ALL: false, DT: false, SC: false, AN: false,
                US: false, ECHO: false, CR: false, XA: false,
                MR: false, CTMR: false, PX: false, DX: false,
                MR2: false, NM: false, RF: false, CT: false,
            },
        });
        onFilterReset?.();
    };

    const tabs = [
        { id: 'Unreported', label: 'Unreported', color: 'bg-amber-500' },
        { id: 'Reported', label: 'Reported', color: 'bg-emerald-500' },
        { id: 'All Cases', label: 'All Cases', color: 'bg-slate-600' },
        { id: 'Drafted', label: 'Drafted', color: 'bg-sky-500' },
    ];

    return (
        <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header with Tabs */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center gap-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                relative px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200
                                ${activeTab === tab.id
                                    ? `${tab.color} text-white shadow-sm`
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
                    className={`
                        flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                        ${!isFilterCollapsed
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }
                    `}
                >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {isFilterCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Filter Panel */}
            {!isFilterCollapsed && (
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
            )}
        </div>
    );
};

export default DoctorDashboardHeader;
