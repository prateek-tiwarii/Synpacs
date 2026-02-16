import { useState } from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Filter, RotateCcw, Search, SlidersHorizontal, Calendar, Building2, Activity, User } from "lucide-react";

interface SearchFilters {
  minAge: string;
  maxAge: string;
  startDate: string;
  endDate: string;
  modality: string;
    sex: 'all' | 'M' | 'F';
    centerId: string;
    keyword: string;
}

interface SearchOptionsProps {
  onSearch?: (filters: SearchFilters) => void;
    availableCenters?: { id: string; name: string }[];
}

export const SearchOptions: React.FC<SearchOptionsProps> = ({ onSearch, availableCenters = [] }) => {
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(true);
    const [filters, setFilters] = useState<SearchFilters>({
    minAge: '',
    maxAge: '',
    startDate: '',
    endDate: '',
    modality: '',
        sex: 'all',
        centerId: 'all',
        keyword: '',
  });

  const handleResetFilters = () => {
    setFilters({
      minAge: '',
      maxAge: '',
      startDate: '',
      endDate: '',
      modality: '',
            sex: 'all',
            centerId: 'all',
            keyword: '',
    });
  };

  return (
        <div className="border border-slate-200 bg-white rounded-xl shadow-sm overflow-hidden mb-4">
      {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-linear-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500" />
                        <h2 className="text-sm font-bold text-slate-700">Research</h2>
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
                {/* Keyword Search */}
                <div className="space-y-1">
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        <Search className="w-3 h-3" />
                        Keyword Search
                    </label>
                    <Input
                        type="text"
                        placeholder="Search by patient name, case ID, accession number, description..."
                        value={filters.keyword}
                        onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                        className="bg-white border-slate-200 h-9 text-sm rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                    />
                </div>

                {/* Row 1: Sex, Modality, Center */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <User className="w-3 h-3" />
                            Sex
                        </label>
                        <Select value={filters.sex} onValueChange={(value) => setFilters({ ...filters, sex: value as SearchFilters['sex'] })}>
                            <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All</SelectItem>
                                <SelectItem value="M" className="text-xs">Male</SelectItem>
                                <SelectItem value="F" className="text-xs">Female</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Activity className="w-3 h-3" />
                            Modality
                        </label>
                        <Select value={filters.modality || 'all'} onValueChange={(value) => setFilters({ ...filters, modality: value === 'all' ? '' : value })}>
                            <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All</SelectItem>
                                {['CT', 'MR', 'US', 'CR', 'XA', 'NM', 'DX', 'RF', 'SC', 'DT', 'ECHO'].map((m) => (
                                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                            <Building2 className="w-3 h-3" />
                            Center
                        </label>
                        <Select value={filters.centerId} onValueChange={(value) => setFilters({ ...filters, centerId: value })}>
                            <SelectTrigger className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="text-xs">All Centers</SelectItem>
                                {availableCenters.map((c) => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Row 2: Min/Max Age, Start/End Date */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Min Age</label>
                        <Input
                            type="number"
                            placeholder="All"
                            value={filters.minAge}
                            onChange={(e) => setFilters({ ...filters, minAge: e.target.value })}
                            className="bg-white border-slate-200 h-8 text-xs rounded-md focus:ring-1 focus:ring-slate-200 focus:border-slate-400 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Max Age</label>
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
                </div>

                <div className="flex items-end justify-end gap-2">
                    <Button
                        onClick={() => onSearch?.(filters)}
                        className="bg-slate-800 hover:bg-slate-900 h-8 px-4 text-xs font-semibold rounded-md shadow-sm hover:shadow transition-all duration-200"
                    >
                        <Filter className="w-3.5 h-3.5 mr-1.5" />
                        Apply
                    </Button>
                    <Button
                        onClick={handleResetFilters}
                        variant="outline"
                        className="h-8 px-4 text-xs font-semibold rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all duration-200"
                    >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Reset
                    </Button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
