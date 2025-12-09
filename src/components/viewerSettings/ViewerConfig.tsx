import { 
  Star, Layers, Monitor, Keyboard, FileText 
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"

export const ViewerConfig = () => {
  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible defaultValue="tool-selection" className="w-full space-y-4">
        
        {/* Favourites */}
        <AccordionItem value="favourites" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-black" />
              <span className="font-semibold text-gray-900">Favourites</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-4 text-gray-500">Favourites content goes here...</div>
          </AccordionContent>
        </AccordionItem>

        {/* Tool Selection */}
        <AccordionItem value="tool-selection" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-black" />
              <span className="font-semibold text-gray-900">Tool Selection</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="py-4 space-y-8">
              <div className="grid grid-cols-4 gap-y-6 gap-x-4">
                {/* Row 1 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Series Tiles</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Contrast Adjustment</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Scroll</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Pan</span>
                </label>

                {/* Row 2 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Zoom</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Display Original Size</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Rotate 90° CW</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Rotate 90° CW</span>
                </label>

                {/* Row 3 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Flip H</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Flip V</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Reset</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Show/Hide Scout Lines</span>
                </label>

                {/* Row 4 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Sync (Auto/Manual)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Show/Hide Overlay</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Invert Color</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Copy to Clipboard</span>
                </label>

                {/* Row 5 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">MPR (Sag/Ax/Cor)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">MIP (Intensity Bar)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">VR</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Distance</span>
                </label>

                {/* Row 6 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Angle</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Ellipse</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Freehand Measurement</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">Spine Labeling</span>
                </label>

                {/* Row 7 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox className="data-[state=checked]:bg-black data-[state=checked]:border-black" defaultChecked />
                  <span className="text-sm font-medium text-gray-700">HU Value Pinpoint</span>
                </label>
              </div>

              <div className="pt-4">
                <Button className="bg-black hover:bg-gray-800 text-white px-8 w-40">
                  Save
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Multimodality Viewer */}
        <AccordionItem value="multimodality" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-black" />
              <span className="font-semibold text-gray-900">Multimodality Viewer</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-4 text-gray-500">Multimodality Viewer content goes here...</div>
          </AccordionContent>
        </AccordionItem>

        {/* Shortcuts */}
        <AccordionItem value="shortcuts" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-black" />
              <span className="font-semibold text-gray-900">Shortcuts</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-4 text-gray-500">Shortcuts content goes here...</div>
          </AccordionContent>
        </AccordionItem>

        {/* Viewing & Reporting Mode */}
        <AccordionItem value="viewing-mode" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-black" />
              <span className="font-semibold text-gray-900">Viewing & Reporting Mode</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="p-4 text-gray-500">Viewing & Reporting Mode content goes here...</div>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  )
}
