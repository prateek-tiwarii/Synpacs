import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Stethoscope } from 'lucide-react';
import { apiService } from '@/lib/api';

interface Availability {
  available_days: string[];
  available_times: string[];
  on_call: boolean;
}

interface DoctorDetails {
  speciality: string;
  availability: Availability[];
}

interface Doctor {
  _id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  doctor_details: DoctorDetails | null;
  phone: string;
}

interface DoctorResponse {
  success: boolean;
  message: string;
  count: number;
  data: Doctor[];
}

const DoctorAvailablity = () => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAvailableDoctors();
  }, []);

  const fetchAvailableDoctors = async () => {
    try {
      const response = await apiService.getAvailableDoctors() as DoctorResponse;
      if (response.success) {
        setDoctors(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch available doctors:', error);
    } finally {
      setLoading(false);
    }
  };



  const capitalizeDay = (day: string) => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  if (loading) {
    return (
      <Card className="w-96 border-none shadow-md rounded-xl">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-lg font-medium">Doctor Availability</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-sm text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-96 border-none shadow-md">
      <CardHeader className="border-b bg-white rounded-t-xl">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-gray-600" />
          Doctor Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[500px] overflow-y-auto">
          {doctors.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              No doctors available
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {doctors.map((doctor) => (
                <div key={doctor._id} className="p-2 hover:bg-gray-50 transition-colors">
                  {/* Doctor Name and Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doctor.full_name}</p>
                        <p className="text-xs text-gray-500">
                          {doctor.phone || 'No phone number'}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={doctor.is_active ? "default" : "secondary"}
                      className={`text-xs ${doctor.is_active
                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-800'
                        }`}
                    >
                      {doctor.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Availability Info */}
                  {doctor.doctor_details?.availability && doctor.doctor_details.availability.length > 0 && (
                    <div className="space-y-2">
                      {doctor.doctor_details.availability.map((avail, idx) => (
                        <div key={idx} className="pl-6 space-y-1.5">
                          {/* Available Days */}
                          <div className="flex items-start gap-2">
                            <Calendar className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {avail.available_days.map((day, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
                                >
                                  {capitalizeDay(day)}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Available Times */}
                          <div className="flex items-start gap-2">
                            <Clock className="h-3.5 w-3.5 text-purple-600 mt-0.5 shrink-0" />
                            <div className="flex flex-wrap gap-1">
                              {avail.available_times.map((time, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded"
                                >
                                  {time}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* On-call Badge */}
                          {avail.on_call && (
                            <div className="flex items-center gap-2">
                              <Badge className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-100">
                                On Call
                              </Badge>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DoctorAvailablity;