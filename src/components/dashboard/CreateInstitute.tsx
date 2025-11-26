import React, { useState, useEffect } from 'react';
import { Search, Building2, Plus, X, Edit2, Trash2, ChevronDown } from 'lucide-react';
import { apiService } from '@/lib/api';

const InstitutionsManager = () => {
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    institutionName: '',
    email: '',
    phone: '',
    loginAddress: '',
    password: ''
  });

  const [institutions, setInstitutions] = useState<any[]>([]);

  useEffect(() => {
    const fetchInstitutions = async () => {
      try {
        const response: any = await apiService.getAllManagedHospitals();
        if (response.success && Array.isArray(response.data)) {
          const mappedInstitutions = response.data.map((inst: any) => ({
            id: inst._id,
            name: inst.name,
            email: inst.email || 'N/A', // Placeholder if not provided
            phone: inst.phone || 'N/A', // Placeholder if not provided
            login: inst.login || 'N/A', // Placeholder if not provided
            officialHeader: null,
            fontFamily: 'Roboto',
            fontSize: '12px',
            subscription: inst.subscription
          }));
          setInstitutions(mappedInstitutions);
        }
      } catch (error) {
        console.error('Failed to fetch institutions:', error);
      }
    };

    fetchInstitutions();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData({
      institutionName: '',
      email: '',
      phone: '',
      loginAddress: '',
      password: ''
    });
  };

  const handleCreateInstitution = () => {
    // Add institution logic here
    console.log('Creating institution:', formData);
    setShowModal(false);
    handleReset();
  };

  const handleHeaderUpload = (id: string | number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInstitutions(institutions.map(inst =>
        inst.id === id ? { ...inst, officialHeader: file.name } : inst
      ));
    }
  };

  const filteredInstitutions = institutions.filter(inst =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7" />
            Institutions Managed by You
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage hospitals, clinics, and diagnostic centers</p>
        </div>
        {/* <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Institution
        </button> */}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search institutions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent"
        />
      </div>

      {/* Institutions List */}
      <div className="space-y-4">
        {filteredInstitutions.map((institution) => (
          <div
            key={institution.id}
            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
          >
            {/* Institution Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                  {institution.name}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <span className="text-sm text-gray-600">Email: </span>
                <span className="text-sm text-gray-900">{institution.email}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">Phone: </span>
                <span className="text-sm text-gray-900">{institution.phone}</span>
              </div>
              <div className="col-span-2">
                <span className="text-sm text-gray-600">Login: </span>
                <span className="text-sm text-gray-900">{institution.login}</span>
              </div>
            </div>

            {/* Report Formatting */}
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-4">
                Report Formatting
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Official Header
                  </label>
                  <input
                    type="file"
                    id={`header-upload-${institution.id}`}
                    className="hidden"
                    onChange={(e) => handleHeaderUpload(institution.id, e)}
                    accept="image/*,.pdf"
                  />
                  <label
                    htmlFor={`header-upload-${institution.id}`}
                    className="w-full px-4 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-left cursor-pointer flex items-center"
                  >
                    <span className="whitespace-nowrap">Choose File</span>
                    <span className="ml-2 text-gray-400 truncate">
                      {institution.officialHeader || "No file chosen"}
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Family
                  </label>
                  <div className="relative">
                    <select className="w-full px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option>Roboto</option>
                      <option>Arial</option>
                      <option>Times New Roman</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Font Size
                  </label>
                  <div className="relative">
                    <select className="w-full px-4 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                      <option>12px</option>
                      <option>14px</option>
                      <option>16px</option>
                      <option>18px</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Create Institution</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Institution Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    name="institutionName"
                    value={formData.institutionName}
                    onChange={handleInputChange}
                    placeholder="Hospital or Imaging Center Name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="contact@institution.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Phone <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91-XX-XXXXXXXX"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">
                    Login Credentials (Optional)
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Login Address
                      </label>
                      <input
                        type="text"
                        name="loginAddress"
                        value={formData.loginAddress}
                        onChange={handleInputChange}
                        placeholder="unique.institution.id"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Password
                      </label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        placeholder="Leave blank to set later"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleReset}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium"
                >
                  Reset
                </button>
                <button
                  onClick={handleCreateInstitution}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Institution
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionsManager;