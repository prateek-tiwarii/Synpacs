import { useMemo, useRef, useState } from 'react';
import { Search, Plus, Upload, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  getAllReportTemplates,
  removeUserReportTemplate,
  saveUserReportTemplate,
  TEMPLATE_MODALITY_OPTIONS,
  type TemplateModality,
} from '@/lib/reportTemplates';

export const Templates = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [templatesVersion, setTemplatesVersion] = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateContent, setNewTemplateContent] = useState('');
  const [newTemplateModality, setNewTemplateModality] = useState<TemplateModality>('CT');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const templates = useMemo(() => getAllReportTemplates(), [templatesVersion]);

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) || templates[0] || null;

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [searchQuery, templates]);

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return;

    const saved = saveUserReportTemplate({
      name: newTemplateName,
      content: newTemplateContent,
      modality: newTemplateModality,
    });

    setSelectedTemplateId(saved.id);
    setNewTemplateName('');
    setNewTemplateContent('');
    setNewTemplateModality('CT');
    setIsAddModalOpen(false);
    setTemplatesVersion((prev) => prev + 1);
  };

  const handleDeleteTemplate = (templateId: string) => {
    removeUserReportTemplate(templateId);
    setTemplatesVersion((prev) => prev + 1);
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    }
  };

  const handleUploadTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = typeof e.target?.result === 'string' ? e.target.result : '';
      if (!text.trim()) return;
      const templateName = file.name.replace(/\.[^/.]+$/, '');
      const saved = saveUserReportTemplate({
        name: templateName || `Uploaded Template ${Date.now()}`,
        content: text,
        modality: newTemplateModality,
      });
      setSelectedTemplateId(saved.id);
      setTemplatesVersion((prev) => prev + 1);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".txt,.rtf,.doc,.docx"
        className="hidden"
        onChange={handleUploadTemplate}
      />

      <div className="flex justify-between items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search templates..."
            className="pl-9 bg-white border-gray-200"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsAddModalOpen(true)} className="bg-black hover:bg-gray-800 text-white gap-2">
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
          <Button
            variant="outline"
            className="gap-2 text-gray-700 border-gray-300"
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className={`border rounded-lg p-4 transition-colors ${
                selectedTemplate?.id === template.id
                  ? 'bg-gray-100 border-gray-400'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <button className="text-left flex-1" onClick={() => setSelectedTemplateId(template.id)}>
                  <p className="font-semibold text-gray-900">{template.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {template.modality} • {template.source === 'system' ? 'System' : 'User'}
                  </p>
                </button>
                {template.source === 'user' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-gray-500 hover:text-red-600"
                    onClick={() => handleDeleteTemplate(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="text-center py-4 text-gray-500">No templates found</div>
          )}
        </div>

        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Preview</h3>
          {selectedTemplate ? (
            <>
              <h4 className="text-black font-medium mb-4">{selectedTemplate.name}</h4>
              <div className="bg-gray-100 rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap font-mono">
                {selectedTemplate.content}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No template selected.</p>
          )}
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add New Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Template Name</label>
              <Input
                placeholder="Enter template name"
                className="border-gray-300"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Modality</label>
              <Select value={newTemplateModality} onValueChange={(value) => setNewTemplateModality(value as TemplateModality)}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Select modality" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_MODALITY_OPTIONS.map((modality) => (
                    <SelectItem key={modality} value={modality}>
                      {modality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Template Content</label>
              <Textarea
                placeholder="Enter template content..."
                className="min-h-[200px] border-gray-300 resize-none"
                value={newTemplateContent}
                onChange={(e) => setNewTemplateContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="border-gray-300">
              Cancel
            </Button>
            <Button className="bg-black hover:bg-gray-800 text-white px-8" onClick={handleSaveTemplate}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
