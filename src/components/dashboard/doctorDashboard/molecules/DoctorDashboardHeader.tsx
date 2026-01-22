import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import FilterPanel from "@/components/common/FilterPanel";
import type { FilterState } from "@/components/common/FilterPanel";

const DoctorDashboardHeader = ({
    activeTab,
    setActiveTab,
    isFilterCollapsed,
    setIsFilterCollapsed,
    onFilterChange,
    onFilterReset,
    setActivePeriod,
    activePeriod,
    filters }
    : {
        activeTab: string,
        setActiveTab: any
        isFilterCollapsed: boolean,
        setIsFilterCollapsed: any,
        onFilterChange: any,
        onFilterReset: any,
        setActivePeriod: any,
        activePeriod: string,
        filters: FilterState
    }) => {

    const tabs = [
        { id: 'Unreported', label: 'Unreported', color: 'bg-amber-500' },
        { id: 'Drafted', label: 'Drafted', color: 'bg-sky-500' },
        { id: 'Reported', label: 'Reported', color: 'bg-emerald-500' },
        { id: 'All Cases', label: 'All Cases', color: 'bg-slate-600' },
        { id: 'Review', label: 'Review', color: 'bg-purple-500' },
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
                <FilterPanel
                    onFilterChange={onFilterChange}
                    onFilterReset={onFilterReset}
                    activePeriod={activePeriod}
                    setActivePeriod={setActivePeriod}
                    initialFilters={filters}
                />
            )}
        </div>
    );
};

export default DoctorDashboardHeader;
