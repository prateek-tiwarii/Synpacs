import { useState } from "react";
import { FileSpreadsheet, Calendar as CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

interface AuditSectionProps {
    onExportAudit: (startDate: Date | undefined, endDate: Date | undefined, selectedModalities: string[]) => void;
}

const MODALITY_OPTIONS = [
    { value: 'CT', label: 'CT' },
    { value: 'MRI', label: 'MRI' },
    { value: 'X-RAY', label: 'X-Ray' },
    { value: 'ULTRASOUND', label: 'Ultrasound' },
    { value: 'MAMMOGRAPHY', label: 'Mammography' },
    { value: 'PET', label: 'PET' },
    { value: 'NUCLEAR_MEDICINE', label: 'Nuclear Medicine' },
    { value: 'FLUOROSCOPY', label: 'Fluoroscopy' },
];

export const AuditSection: React.FC<AuditSectionProps> = ({ onExportAudit }) => {
    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [selectedModalities, setSelectedModalities] = useState<string[]>([]);
    const [modalityDropdownOpen, setModalityDropdownOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);

    const handleModalityToggle = (value: string) => {
        setSelectedModalities(prev =>
            prev.includes(value)
                ? prev.filter(m => m !== value)
                : [...prev, value]
        );
    };

    const handleExport = () => {
        onExportAudit(startDate, endDate, selectedModalities);
    };

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-200 bg-slate-50 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                        <h3 className="text-sm font-semibold text-slate-800">Audit Export</h3>
                    </div>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    >
                        {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                        {isCollapsed ? 'Show' : 'Hide'}
                    </button>
                </div>
            </CardHeader>

            {!isCollapsed && (
            <CardContent className="pt-4">
                <div className="flex items-end gap-4 flex-wrap">
                    {/* Start Date */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700">Start Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-[180px] justify-start text-left font-normal h-9 text-xs"
                                >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {startDate ? format(startDate, "dd MMM yyyy") : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
                                    <Calendar
                                        onChange={(value) => setStartDate(value as Date)}
                                        value={startDate}
                                        className="border-0"
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* End Date */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700">End Date</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-[180px] justify-start text-left font-normal h-9 text-xs"
                                >
                                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                    {endDate ? format(endDate, "dd MMM yyyy") : "Pick a date"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left' }}>
                                    <Calendar
                                        onChange={(value) => setEndDate(value as Date)}
                                        value={endDate}
                                        className="border-0"
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Modality Multi-Select */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-medium text-slate-700">Modalities</label>
                        <Popover open={modalityDropdownOpen} onOpenChange={setModalityDropdownOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-[200px] justify-start text-left font-normal h-9 text-xs"
                                >
                                    {selectedModalities.length > 0
                                        ? `${selectedModalities.length} selected`
                                        : "Select modalities"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[200px] p-2" align="start">
                                <div className="space-y-1.5">
                                    {MODALITY_OPTIONS.map((option) => (
                                        <label
                                            key={option.value}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded text-xs"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedModalities.includes(option.value)}
                                                onChange={() => handleModalityToggle(option.value)}
                                                className="w-3.5 h-3.5 rounded border-slate-300"
                                            />
                                            <span>{option.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={handleExport}
                        size="sm"
                        className="h-9 gap-1.5"
                        disabled={!startDate || !endDate}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        Export Audit
                    </Button>

                    {/* Clear Filters */}
                    {(startDate || endDate || selectedModalities.length > 0) && (
                        <Button
                            onClick={() => {
                                setStartDate(undefined);
                                setEndDate(undefined);
                                setSelectedModalities([]);
                            }}
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs"
                        >
                            Clear
                        </Button>
                    )}
                </div>

                {/* Selected Summary */}
                {selectedModalities.length > 0 && (
                    <div className="mt-3 text-xs text-slate-600">
                        <span className="font-medium">Selected modalities:</span>{' '}
                        {selectedModalities.map(m => MODALITY_OPTIONS.find(o => o.value === m)?.label).join(', ')}
                    </div>
                )}
            </CardContent>
            )}
        </Card>
    );
};
