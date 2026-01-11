
import { useState } from 'react';
import { X, Search, Plus, Calendar, Clock, ChevronDown, Edit2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// Mock data - will be replaced with API calls
const MOCK_DATA = {
  centers: [
    { id: 1, name: 'City Hospital' },
    { id: 2, name: 'Metro Imaging' },
    { id: 3, name: 'Sunrise Center' },
    { id: 4, name: 'North Diagnostic' },
    { id: 5, name: 'West Care' }
  ],
  modalities: [
    { id: 1, code: 'DX', name: 'Digital Radiography' },
    { id: 2, code: 'CR', name: 'Computed Radiography' },
    { id: 3, code: 'NM', name: 'Nuclear Medicine' },
    { id: 4, code: 'Echo', name: 'Echocardiography' },
    { id: 5, code: 'PET-CT', name: 'PET-CT Scan' }
  ],
  priorities: [
    { id: 1, name: 'STAT' },
    { id: 2, name: 'Critical' },
    { id: 3, name: 'Routine' }
  ],
  caseTypes: [
    { id: 1, name: 'Brain' },
    { id: 2, name: 'Head' },
    { id: 3, name: 'Spine' },
    { id: 4, name: 'Abdomen' },
    { id: 5, name: 'Chest' }
  ],
  doctors: [
    { id: 1, name: 'Dr. Smith' },
    { id: 2, name: 'Dr. Johnson' },
    { id: 3, name: 'Dr. Williams' }
  ]
};

const MultiSelectList = ({ title, items, selectedItems, setSelectedItems, searchPlaceholder, onAddNew, addNewPlaceholder }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newItem, setNewItem] = useState('');

  const filteredItems = items.filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleItem = (itemId: any) => {
    setSelectedItems((prev: any) =>
      prev.includes(itemId)
        ? prev.filter((id: any) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const selectAll = () => setSelectedItems(items.map((item: any) => item.id));
  const clearAll = () => setSelectedItems([]);

  const handleAddNew = () => {
    if (newItem.trim()) {
      onAddNew?.(newItem);
      setNewItem('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={selectAll} className="h-7 text-xs bg-white! text-gray-900! border-gray-300! hover:bg-gray-50!">
            All
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="h-7 text-xs bg-white! text-gray-900! border-gray-300! hover:bg-gray-50!">
            Clear
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="text-xs text-gray-500 px-1">
        {selectedItems.length} selected
      </div>

      <div className="border rounded-md max-h-36 overflow-y-auto bg-white [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400">
        {filteredItems.map((item: any) => (
          <label
            key={item.id}
            className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
          >
            <Checkbox
              checked={selectedItems.includes(item.id)}
              onCheckedChange={() => toggleItem(item.id)}
              className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
            />
            <span className="text-sm text-gray-700">
              {item.code ? `${item.code}` : item.name}
            </span>
          </label>
        ))}
      </div>

      {onAddNew && (
        <div className="flex gap-2">
          <Input
            placeholder={addNewPlaceholder}
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddNew()}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleAddNew} className="h-8 bg-black! text-white! hover:bg-gray-800!">
            Add
          </Button>
        </div>
      )}
    </div>
  );
};

const RuleForm = ({ rule, onClose, onSave }: any) => {
  const [ruleName, setRuleName] = useState(rule?.ruleName || '');
  const [isActive, setIsActive] = useState(rule?.isActive || 'Yes');

  const [selectedCenters, setSelectedCenters] = useState(rule?.selectedCenters || []);
  const [selectedModalities, setSelectedModalities] = useState(rule?.selectedModalities || []);
  const [selectedPriorities, setSelectedPriorities] = useState(rule?.selectedPriorities || []);
  const [selectedCaseTypes, setSelectedCaseTypes] = useState(rule?.selectedCaseTypes || []);

  const [startDate, setStartDate] = useState(rule?.startDate || '');
  const [endDate, setEndDate] = useState(rule?.endDate || '');
  const [startTime, setStartTime] = useState(rule?.startTime || '');
  const [endTime, setEndTime] = useState(rule?.endTime || '');
  const [allTime, setAllTime] = useState(rule?.allTime || false);

  const [selectedDoctor, setSelectedDoctor] = useState(rule?.selectedDoctor || '');
  const [caseCount, setCaseCount] = useState(rule?.caseCount || '');
  const [allCases, setAllCases] = useState(rule?.allCases || false);

  const [centers] = useState(MOCK_DATA.centers);
  const [modalities, setModalities] = useState(MOCK_DATA.modalities);
  const [caseTypes, setCaseTypes] = useState(MOCK_DATA.caseTypes);

  const handleSave = () => {
    const ruleData = {
      id: rule?.id || Date.now(),
      ruleName,
      isActive,
      selectedCenters,
      selectedModalities,
      selectedPriorities,
      selectedCaseTypes,
      startDate,
      endDate,
      startTime,
      endTime,
      allTime,
      selectedDoctor,
      caseCount,
      allCases
    };
    onSave(ruleData);
    onClose();
  };

  const hasConditions = selectedCenters.length > 0 || selectedModalities.length > 0 ||
    selectedPriorities.length > 0 || selectedCaseTypes.length > 0;
  const hasAssignment = selectedDoctor && (caseCount || allCases);

  return (
    <Card className="shadow-sm border mb-6">
      <CardHeader className="bg-linear-to-r from-gray-900 via-black to-gray-900 text-white! pb-6 pt-6 px-8 border-b-2 border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-1 bg-blue-500 rounded-full"></div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {rule ? 'Edit Automation Rule' : 'Create New Rule'}
              </CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                {rule ? 'Modify your automation settings below' : 'Define conditions and actions for automatic case assignment'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white! hover:bg-gray-800! h-10 w-10 rounded-full transition-all hover:rotate-90"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Rule Name and Active Status */}
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Rule Name</label>
            <Input
              placeholder="e.g. STAT CT Chest from City Hospital"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Active</label>
            <Select value={isActive} onValueChange={setIsActive}>
              <SelectTrigger className="bg-white! text-gray-900!">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Yes">Yes</SelectItem>
                <SelectItem value="No">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Multi-select sections - 2 columns */}
        <div className="grid grid-cols-2 gap-6">
          <MultiSelectList
            title="Center(s)"
            items={centers}
            selectedItems={selectedCenters}
            setSelectedItems={setSelectedCenters}
            searchPlaceholder="Search..."
          />

          <MultiSelectList
            title="Modality(ies)"
            items={modalities}
            selectedItems={selectedModalities}
            setSelectedItems={setSelectedModalities}
            searchPlaceholder="Search..."
            onAddNew={(name: any) => {
              const newModality = { id: Date.now(), code: name.substring(0, 3).toUpperCase(), name };
              setModalities([...modalities, newModality]);
            }}
            addNewPlaceholder="Add new modality"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <MultiSelectList
            title="Priority(ies)"
            items={MOCK_DATA.priorities}
            selectedItems={selectedPriorities}
            setSelectedItems={setSelectedPriorities}
            searchPlaceholder="Search..."
          />

          <MultiSelectList
            title="Case Type(s)"
            items={caseTypes}
            selectedItems={selectedCaseTypes}
            setSelectedItems={setSelectedCaseTypes}
            searchPlaceholder="Search..."
            onAddNew={(name: any) => {
              const newCaseType = { id: Date.now(), name };
              setCaseTypes([...caseTypes, newCaseType]);
            }}
            addNewPlaceholder="Add new case type"
          />
        </div>

        {/* Date and Time Selection - 2 columns */}
        <div className="border-t pt-6 space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 bg-white! text-gray-900! [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 bg-white! text-gray-900! [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Start Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={allTime}
                  className="pl-10 bg-white! text-gray-900! disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-full"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">End Time</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={allTime}
                  className="pl-10 bg-white! text-gray-900! disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-full"
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={allTime}
              onCheckedChange={setAllTime}
              className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
            />
            <span className="text-sm text-gray-700">All Time</span>
          </label>
        </div>

        {/* Assignment Section - 2 columns */}
        <div className="border-t pt-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Assign to Doctor</label>
              <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                <SelectTrigger className="bg-white! text-gray-900!">
                  <SelectValue placeholder="Select Doctor" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_DATA.doctors.map(doctor => (
                    <SelectItem key={doctor.id} value={doctor.id.toString()}>
                      {doctor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">How many cases?</label>
              <Input
                type="number"
                placeholder="Enter number"
                value={caseCount}
                onChange={(e) => setCaseCount(e.target.value)}
                disabled={allCases}
              />
              <label className="flex items-center gap-2 cursor-pointer mt-2">
                <Checkbox
                  checked={allCases}
                  onCheckedChange={setAllCases}
                  className="bg-white! border-gray-300! data-[state=checked]:bg-black! data-[state=checked]:border-black! data-[state=checked]:text-white!"
                />
                <span className="text-xs text-gray-500">ALL - Use box to type a number, or tick ALL</span>
              </label>
            </div>
          </div>
        </div>

        {/* Rule Preview */}
        <Card className="bg-gray-50 border">
          <CardContent className="p-4 space-y-2">
            <div className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
              Rule Preview
            </div>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium text-gray-900">WHEN:</span>
                <p className="text-gray-600 text-xs mt-0.5">
                  {hasConditions ? (
                    <>
                      Conditions set for {selectedCenters.length} center(s), {selectedModalities.length} modality(ies),
                      {' '}{selectedPriorities.length} priority(ies), {selectedCaseTypes.length} case type(s)
                    </>
                  ) : (
                    'No conditions set'
                  )}
                </p>
              </div>
              <div>
                <span className="font-medium text-gray-900">THEN:</span>
                <p className="text-gray-600 text-xs mt-0.5">
                  {hasAssignment ? (
                    <>Assign to {MOCK_DATA.doctors.find(d => d.id.toString() === selectedDoctor)?.name}
                      {allCases ? ' (ALL cases)' : caseCount ? ` (${caseCount} cases)` : ''}</>
                  ) : (
                    'No assignment configured'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="px-6 bg-white! text-gray-900! border-gray-300! hover:bg-gray-50!">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="px-6 bg-black! text-white! hover:bg-gray-800!"
          >
            Save Rule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const RuleCard = ({ rule, onEdit, onDelete }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-4 flex-1">
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            <div>
              <h3 className="font-medium text-gray-900">{rule.ruleName}</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                {rule.selectedCenters.length} center(s) • {rule.selectedModalities.length} modality(ies)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={rule.isActive === 'Yes' ? 'default' : 'secondary'} className={rule.isActive === 'Yes' ? 'bg-green-600' : ''}>
              {rule.isActive === 'Yes' ? 'Active' : 'Inactive'}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(rule);
              }}
              className="h-8 w-8 p-0 bg-white! text-gray-700! hover:bg-gray-100!"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(rule.id);
              }}
              className="h-8 w-8 p-0 bg-white! text-red-600! hover:bg-red-50! hover:text-red-700!"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3 text-sm">
            <div>
              <span className="font-medium text-gray-700">Centers:</span>
              <p className="text-gray-600 mt-1">
                {rule.selectedCenters.map((id: any) => MOCK_DATA.centers.find(c => c.id === id)?.name).join(', ') || 'None'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Modalities:</span>
              <p className="text-gray-600 mt-1">
                {rule.selectedModalities.map((id: any) => MOCK_DATA.modalities.find(m => m.id === id)?.code).join(', ') || 'None'}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-700">Assignment:</span>
              <p className="text-gray-600 mt-1">
                {rule.selectedDoctor ? `${MOCK_DATA.doctors.find(d => d.id.toString() === rule.selectedDoctor)?.name} ${rule.allCases ? '(ALL)' : `(${rule.caseCount})`}` : 'None'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export function Automation() {
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [rules, setRules] = useState<any[]>([]);

  const handleSaveRule = (ruleData: any) => {
    if (editingRule) {
      setRules(rules.map((r: any) => r.id === ruleData.id ? ruleData : r));
    } else {
      setRules([...rules, ruleData]);
    }
    setEditingRule(null);
    setShowForm(false);
  };

  const handleEditRule = (rule: any) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDeleteRule = (ruleId: any) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      setRules(rules.filter((r: any) => r.id !== ruleId));
    }
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Automation Rules</h1>
          <Button
            onClick={handleNewRule}
            className="bg-black! text-white! hover:bg-gray-800!"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>

        {/* Form */}
        {showForm && (
          <RuleForm
            rule={editingRule}
            onClose={() => {
              setShowForm(false);
              setEditingRule(null);
            }}
            onSave={handleSaveRule}
          />
        )}

        {/* Active Rules Section */}
        <Card className="shadow-sm border">
          <CardHeader className="bg-white border-b">
            <CardTitle className="text-xl font-bold text-gray-900">Active Rules</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {rules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No automation rules defined yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule: any) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={handleEditRule}
                    onDelete={handleDeleteRule}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}