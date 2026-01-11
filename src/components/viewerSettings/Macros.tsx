import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

export const Macros = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

  return (
    <div className="space-y-6">
      {/* Search and Add Action */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search macros..."
            className="pl-9 bg-white border-gray-200 focus-visible:ring-black"
          />
        </div>
        <Button
          onClick={() => setIsAddModalOpen(true)}
          className="w-10 h-10 p-0 rounded-md bg-black hover:bg-gray-800 text-white"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Macros List */}
      <div className="space-y-4">
        <Accordion type="single" collapsible defaultValue="normal-findings" className="w-full space-y-4">

          {/* Normal Findings */}
          <AccordionItem value="normal-findings" className="border rounded-lg px-4 bg-white">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="font-semibold text-gray-900">Normal Findings</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4 text-gray-600">
                No acute abnormality identified. Case appears within normal limits for age.
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Follow-up Recommendation */}
          <AccordionItem value="follow-up" className="border rounded-lg px-4 bg-gray-50">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="font-semibold text-gray-700">Follow-up Recommendation</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4 text-gray-600">
                Recommend follow-up MRI in 6 months to monitor stability.
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Clinical Correlation */}
          <AccordionItem value="clinical-correlation" className="border rounded-lg px-4 bg-white">
            <AccordionTrigger className="hover:no-underline py-4">
              <span className="font-semibold text-gray-900">Clinical Correlation</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2 pb-4 text-gray-600">
                Please correlate with clinical symptoms and laboratory findings.
              </div>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>

      {/* Add Macro Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add New Macro</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Macro Name</label>
              <Input
                placeholder=""
                className="border-gray-300 focus-visible:ring-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Macro Content</label>
              <Textarea
                placeholder=""
                className="min-h-[150px] border-gray-300 resize-none focus-visible:ring-black"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-full bg-black hover:bg-gray-800 text-white py-6 text-base"
              onClick={() => setIsAddModalOpen(false)}
            >
              Save Macro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
