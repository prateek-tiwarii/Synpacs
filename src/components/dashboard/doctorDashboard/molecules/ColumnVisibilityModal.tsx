import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, GripVertical } from 'lucide-react';
import type { VisibilityState } from '@tanstack/react-table';

interface ColumnConfig {
  id: string;
  label: string;
}

interface ColumnVisibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

const COLUMN_CONFIG: ColumnConfig[] = [
  { id: 'name', label: 'Patient Name' },
  { id: 'pac_patinet_id', label: 'Patient ID' },
  { id: 'age', label: 'Age' },
  { id: 'sex', label: 'Sex' },
  { id: 'study_description', label: 'Study Description' },
  { id: 'treatment_type', label: 'Treatment Type' },
  { id: 'status', label: 'Status' },
  { id: 'referring_doctor', label: 'Referring Doctor' },
  { id: 'date_of_capture', label: 'Date of Capture' },
  { id: 'pac_images_count', label: 'Images Count' },
  { id: 'hospital_id', label: 'Hospital ID' },
  { id: 'accession_number', label: 'Accession Number' },
];

const ColumnVisibilityModal = ({
  open,
  onOpenChange,
  columnVisibility,
  onColumnVisibilityChange,
}: ColumnVisibilityModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [localVisibility, setLocalVisibility] = useState<VisibilityState>(columnVisibility);

  // Reset local state when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalVisibility(columnVisibility);
      setSearchQuery('');
    }
    onOpenChange(isOpen);
  };

  const filteredColumns = useMemo(() => {
    if (!searchQuery.trim()) return COLUMN_CONFIG;
    return COLUMN_CONFIG.filter((col) =>
      col.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const visibleCount = useMemo(() => {
    return COLUMN_CONFIG.filter((col) => localVisibility[col.id] !== false).length;
  }, [localVisibility]);

  const allSelected = visibleCount === COLUMN_CONFIG.length;
  const noneSelected = visibleCount === 0;

  const handleToggleColumn = (columnId: string) => {
    setLocalVisibility((prev) => ({
      ...prev,
      [columnId]: prev[columnId] === false ? true : false,
    }));
  };

  const handleSelectAll = () => {
    const newVisibility: VisibilityState = {};
    COLUMN_CONFIG.forEach((col) => {
      newVisibility[col.id] = true;
    });
    setLocalVisibility(newVisibility);
  };

  const handleDeselectAll = () => {
    const newVisibility: VisibilityState = {};
    COLUMN_CONFIG.forEach((col) => {
      newVisibility[col.id] = false;
    });
    setLocalVisibility(newVisibility);
  };

  const handleConfirm = () => {
    onColumnVisibilityChange(localVisibility);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalVisibility(columnVisibility);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b bg-slate-50">
          <DialogTitle className="text-base font-semibold text-slate-800">
            Preferences
          </DialogTitle>
        </DialogHeader>

        {/* Search and Actions */}
        <div className="px-4 py-3 border-b bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Find a column"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-white border-slate-200 focus-visible:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-500">
              {visibleCount} of {COLUMN_CONFIG.length} visible
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                disabled={allSelected}
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
                disabled={noneSelected}
                className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                Deselect all
              </Button>
            </div>
          </div>
        </div>

        {/* Column List */}
        <div className="max-h-[320px] overflow-y-auto">
          {filteredColumns.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No columns match your search
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredColumns.map((column) => {
                const isVisible = localVisibility[column.id] !== false;
                return (
                  <label
                    key={column.id}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    <Checkbox
                      checked={isVisible}
                      onCheckedChange={() => handleToggleColumn(column.id)}
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span className="text-sm text-slate-700 select-none">
                      {column.label}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t bg-slate-50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="h-8 px-4 text-sm"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            className="h-8 px-4 text-sm bg-blue-600 hover:bg-blue-700"
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ColumnVisibilityModal;

