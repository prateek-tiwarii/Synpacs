import  { useState } from 'react'
import { Search, Plus, Upload } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface Template {
  id: string
  name: string
  content: string
  type: 'pre-uploaded' | 'user-added'
}

const initialTemplates: Template[] = [
  {
    id: '1',
    name: 'MRI Spine - Comprehensive',
    type: 'pre-uploaded',
    content: `TECHNIQUE:
MRI of the spine performed.

FINDINGS:
- Vertebral alignment: Normal
- Discs: Intact
- Cord: Normal signal

IMPRESSION:
No significant abnormality.`
  },
  {
    id: '2',
    name: 'CT Head - Normal',
    type: 'pre-uploaded',
    content: `TECHNIQUE:
CT of the head without contrast.

FINDINGS:
- Brain parenchyma: Normal attenuation. No mass, hemorrhage, or acute infarction.
- Ventricles and sulci: Normal for age.
- Bones: No fracture.

IMPRESSION:
Normal CT head.`
  }
]

export const Templates = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplates[0].id)
  const [searchQuery, setSearchQuery] = useState('')
  
  // New template form state
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0]

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return

    const newTemplate: Template = {
      id: Date.now().toString(),
      name: newTemplateName,
      content: newTemplateContent,
      type: 'user-added'
    }

    setTemplates([...templates, newTemplate])
    setSelectedTemplateId(newTemplate.id)
    setNewTemplateName('')
    setNewTemplateContent('')
    setIsAddModalOpen(false)
  }

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox id="pre-uploaded" className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
          <label htmlFor="pre-uploaded" className="text-sm font-medium text-gray-900">Pre Uploaded Templates</label>
        </div>
        
        <div className="flex gap-6 pl-6">
          <div className="flex items-center gap-2">
            <Checkbox id="concise" className="rounded-full data-[state=checked]:bg-black data-[state=checked]:border-black" />
            <label htmlFor="concise" className="text-sm text-gray-600">Concise</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="long" defaultChecked className="rounded-full data-[state=checked]:bg-black data-[state=checked]:border-black" />
            <label htmlFor="long" className="text-sm text-gray-600">Long with subheadings</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="paragraph" className="rounded-full data-[state=checked]:bg-black data-[state=checked]:border-black" />
            <label htmlFor="paragraph" className="text-sm text-gray-600">Paragraph form</label>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="user-added" className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
          <label htmlFor="user-added" className="text-sm font-medium text-gray-900">Added by User</label>
        </div>
      </div>

      {/* Search and Actions */}
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
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-black hover:bg-gray-800 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Templates
          </Button>
          <Button variant="outline" className="gap-2 text-gray-700 border-gray-300">
            <Upload className="h-4 w-4" />
            Upload Template
          </Button>
        </div>
      </div>

      {/* Template List & Preview */}
      <div className="space-y-4">
        {/* Template List */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filteredTemplates.map((template) => (
            <div 
              key={template.id}
              onClick={() => setSelectedTemplateId(template.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedTemplateId === template.id 
                  ? 'bg-gray-100 border-gray-400' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
            >
              <span className="font-semibold text-gray-900">{template.name}</span>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="text-center py-4 text-gray-500">No templates found</div>
          )}
        </div>

        {/* Preview Section */}
        <div className="border border-gray-200 rounded-xl p-6 bg-white">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Preview</h3>
          <h4 className="text-black font-medium mb-4">{selectedTemplate?.name}</h4>
          
          <div className="bg-gray-100 rounded-lg p-6 text-sm text-gray-800 whitespace-pre-wrap font-mono">
            {selectedTemplate?.content}
          </div>
        </div>
      </div>

      {/* Add Template Modal */}
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
            <Button 
              className="bg-black hover:bg-gray-800 text-white px-8"
              onClick={handleSaveTemplate}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
