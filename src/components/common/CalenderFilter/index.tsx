import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalenderFilterProps {
  startDate?: Date;
  endDate?: Date;
  onStartDateChange?: (date: Date | undefined) => void;
  onEndDateChange?: (date: Date | undefined) => void;
  className?: string;
}

const CalenderFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
}: CalenderFilterProps) => {
  // Default to last 1 month if no dates provided
  const [internalStartDate, setInternalStartDate] = useState<Date | undefined>(
    () => {
      if (startDate) return startDate;
      const date = new Date();
      date.setMonth(date.getMonth() - 1);
      return date;
    }
  );
  const [internalEndDate, setInternalEndDate] = useState<Date | undefined>(
    () => {
      if (endDate) return endDate;
      return new Date();
    }
  );

  // Temporary selections before applying
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>();
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  const currentStartDate = startDate ?? internalStartDate;
  const currentEndDate = endDate ?? internalEndDate;

  const handleApply = () => {
    const newStartDate = tempStartDate ?? currentStartDate;
    const newEndDate = tempEndDate ?? currentEndDate;

    if (onStartDateChange) {
      onStartDateChange(newStartDate);
    } else {
      setInternalStartDate(newStartDate);
    }

    if (onEndDateChange) {
      onEndDateChange(newEndDate);
    } else {
      setInternalEndDate(newEndDate);
    }

    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setIsOpen(false);
  };

  const handleReset = () => {
    const defaultStart = new Date();
    defaultStart.setMonth(defaultStart.getMonth() - 1);
    const defaultEnd = new Date();

    if (onStartDateChange) {
      onStartDateChange(defaultStart);
    } else {
      setInternalStartDate(defaultStart);
    }

    if (onEndDateChange) {
      onEndDateChange(defaultEnd);
    } else {
      setInternalEndDate(defaultEnd);
    }

    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setIsOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTempStartDate(undefined);
      setTempEndDate(undefined);
    }
    setIsOpen(open);
  };

  const displayStartDate = tempStartDate ?? currentStartDate;
  const displayEndDate = tempEndDate ?? currentEndDate;

  return (
    <div className={cn("inline-block", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-10 justify-start text-left font-normal px-2 text-sm cursor-pointer",
              !currentStartDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {currentStartDate && currentEndDate ? (
              <span className="text-sm">
                {format(currentStartDate, "MMM dd, yyyy")} -{" "}
                {format(currentEndDate, "MMM dd, yyyy")}
              </span>
            ) : (
              <span className="text-sm">Select date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="space-y-3">
            {/* Selected dates display */}
            <div className="flex items-center justify-between gap-4 pb-2 border-b text-sm">
              <div>
                <div className="text-muted-foreground text-xs mb-1">Start Date</div>
                <div className="font-medium">
                  {displayStartDate ? format(displayStartDate, "MMM dd, yyyy") : "Not selected"}
                </div>
              </div>
              <div className="text-muted-foreground">→</div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">End Date</div>
                <div className="font-medium">
                  {displayEndDate ? format(displayEndDate, "MMM dd, yyyy") : "Not selected"}
                </div>
              </div>
            </div>

            {/* Calendar */}
            <Calendar
              mode="range"
              classNames={{
                root: "p-0",
              }}
              selected={{
                from: displayStartDate,
                to: displayEndDate,
              }}
              onSelect={(range) => {
                setTempStartDate(range?.from);
                setTempEndDate(range?.to);
              }}
              numberOfMonths={1}
              initialFocus
              className="p-0"
            />

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!displayStartDate || !displayEndDate}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CalenderFilter;