import { useState } from 'react'
import { ViewerConfig } from '@/components/viewerSettings/ViewerConfig'
import { Templates } from '@/components/viewerSettings/Templates'
import { Macros } from '@/components/viewerSettings/Macros'

type TabType = 'viewer' | 'templates' | 'macros'

const ViewerSettings = () => {
  const [activeTab, setActiveTab] = useState<TabType>('viewer')

  const renderContent = () => {
    switch (activeTab) {
      case 'viewer':
        return <ViewerConfig />
      case 'templates':
        return <Templates />
      case 'macros':
        return <Macros />
      default:
        return <ViewerConfig />
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Tabs Header */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('viewer')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'viewer' 
              ? 'bg-black text-white' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Viewer Settings
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'templates' 
              ? 'bg-black text-white' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setActiveTab('macros')}
          className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
            activeTab === 'macros' 
              ? 'bg-black text-white' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Macros
        </button>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px] p-6">
        {renderContent()}
      </div>
    </div>
  )
}

export default ViewerSettings
