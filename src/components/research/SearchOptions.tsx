import React, { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Filter, RotateCcw, Search, SlidersHorizontal, Calendar, Building2, Activity } from "lucide-react";

export const SearchOptions = () => {
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);
  const [filters, setFilters] = useState({
    keywords: '',
    minAge: '',
    maxAge: '',
    center: '',
    startDate: '',
    endDate: '',
    modality: '',
    sex: { male: false, female: false },
  });

  const handleResetFilters = () => {
    setFilters({
      keywords: '',
      minAge: '',
      maxAge: '',
      center: '',
      startDate: '',
      endDate: '',
      modality: '',
      sex: { male: false, female: false },
    });
  };

  return (
    <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-700">Patient Search Options</h2>
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
            <div className="flex flex-col gap-3">
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Calendar className="w-3 h-3" />
                            Start Date
                        </label>
                        <Input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Calendar className="w-3 h-3" />
                            End Date
                        </label>
                        <Input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Search className="w-3 h-3" />
                            Keywords
                        </label>
                        <Input
                            placeholder="E.g. tumor, edema..."
                            value={filters.keywords}
                            onChange={(e) => setFilters({ ...filters, keywords: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Activity className="w-3 h-3" />
                            Modality(ies)
                        </label>
                        <Select
                            value={filters.modality}
                            onValueChange={(value) => setFilters({ ...filters, modality: value })}
                        >
                            <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All</SelectItem>
                                <SelectItem value="ct" className="text-xs">CT</SelectItem>
                                <SelectItem value="mri" className="text-xs">MRI</SelectItem>
                                <SelectItem value="xray" className="text-xs">X-ray</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Sex
                        </label>
                        <div className="flex gap-1.5">
                            <button
                                onClick={() => setFilters({ ...filters, sex: { ...filters.sex, male: !filters.sex.male } })}
                                className={`
                                    flex-1 h-8 rounded-md font-semibold text-xs transition-all duration-200 border
                                    ${filters.sex.male
                                        ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }
                                `}
                            >
                                Male
                            </button>
                            <button
                                onClick={() => setFilters({ ...filters, sex: { ...filters.sex, female: !filters.sex.female } })}
                                className={`
                                    flex-1 h-8 rounded-md font-semibold text-xs transition-all duration-200 border
                                    ${filters.sex.female
                                        ? 'bg-slate-700 border-slate-700 text-white shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                    }
                                `}
                            >
                                Female
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Min Age
                        </label>
                        <Input
                            type="number"
                            placeholder="All"
                            value={filters.minAge}
                            onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>
                </div>

                {/* Row 3 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            Max Age
                        </label>
                        <Input
                            type="number"
                            placeholder="All"
                            value={filters.maxAge}
                            onChange={(e) => setFilters({ ...filters, maxAge: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Building2 className="w-3 h-3" />
                            Center
                        </label>
                        <Select
                            value={filters.center}
                            onValueChange={(value) => setFilters({ ...filters, center: value })}
                        >
                            <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                <SelectValue placeholder="Select Center..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All Centers</SelectItem>
                                <SelectItem value="city" className="text-xs">City Hospital</SelectItem>
                                <SelectItem value="metro" className="text-xs">Metro Imaging</SelectItem>
                                <SelectItem value="sunrise" className="text-xs">Sunrise Center</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-end gap-1.5">
                        <Button
                            className="flex-1 bg-slate-800 hover:bg-slate-900 h-8 text-xs font-semibold rounded-md shadow-sm hover:shadow transition-all duration-200"
                        >
                            <Filter className="w-3.5 h-3.5 mr-1.5" />
                            Apply
                        </Button>
                        <Button
                            onClick={handleResetFilters}
                            variant="outline"
                            className="flex-1 h-8 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
                        >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Reset
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
