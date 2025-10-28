import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Calendar, Users, UserCheck } from "lucide-react";

const patientData = [
  { month: "Jan", reported: 45, assigned: 38 },
  { month: "Feb", reported: 52, assigned: 45 },
  { month: "Mar", reported: 48, assigned: 42 },
  { month: "Apr", reported: 61, assigned: 55 },
  { month: "May", reported: 55, assigned: 50 },
  { month: "Jun", reported: 67, assigned: 62 },
];

const appointmentData: Record<string, number> = {
  "2025-10-28": 3,
  "2025-10-29": 5,
  "2025-10-30": 2,
  "2025-11-01": 4,
  "2025-11-04": 6,
  "2025-11-07": 3,
  "2025-11-12": 4,
};

const DashboardComponent = () => {
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const currentDate = new Date(2025, 9, 28);
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const getDaysInMonth = (month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  };

  const days = getDaysInMonth(currentMonth, currentYear);
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const getAppointmentCount = (day: number | null) => {
    if (!day) return 0;
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return appointmentData[dateStr] || 0;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 w-full max-w-8xl mx-auto">
      {/* Bar Chart Card */}
      <Card className="flex-1 rounded-2xl shadow-md border border-gray-200 bg-white ">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Users className="w-4 h-4 text-blue-600" />
            Patients Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-1">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={patientData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <YAxis
                tick={{ fill: "#475569", fontSize: 11 }}
                axisLine={{ stroke: "#cbd5e1" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#475569" }} />
              <Bar dataKey="reported" fill="#2563eb" name="Medical Patients" radius={[6, 6, 0, 0]} />
              <Bar dataKey="assigned" fill="#93c5fd" name="Appointed Patients" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 flex gap-4 text-xs font-medium text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Medical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-300 rounded"></div>
              <span>Appointed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Card */}
      <Card className="w-[340px] rounded-2xl shadow-md border border-gray-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Calendar className="w-5 h-4 text-blue-600" />
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-center font-bold text-sm text-gray-700">
            {monthNames[currentMonth]} {currentYear}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
              <div
                key={day}
                className="text-center text-[10px] font-semibold p-1 text-gray-500"
              >
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const appointmentCount = getAppointmentCount(day);
              const hasAppointments = appointmentCount > 0;
              const isToday = day === 28;

              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(day)}
                  className={`w-7 h-7 flex flex-col items-center justify-center text-[11px] rounded-md cursor-pointer transition-all
                    ${!day ? "invisible" : ""}
                    ${
                      isToday
                        ? "bg-blue-600 text-white font-bold"
                        : hasAppointments
                        ? "bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700"
                        : "hover:bg-gray-50 text-gray-700"
                    }`}
                >
                  {day && (
                    <>
                      <span>{day}</span>
                      {hasAppointments && (
                        <div className="flex gap-px mt-px">
                          {Array.from({ length: Math.min(appointmentCount, 3) }).map((_, i) => (
                            <div key={i} className="w-1 h-1 bg-blue-600 rounded-full"></div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {selectedDate && getAppointmentCount(selectedDate) > 0 && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 text-xs">
                <UserCheck className="w-3 h-3" />
                {monthNames[currentMonth]} {selectedDate}, {currentYear}
              </div>
              <div className="mt-0.5 text-blue-600 text-xs">
                {getAppointmentCount(selectedDate)} appointment
                {getAppointmentCount(selectedDate) > 1 ? "s" : ""} scheduled
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardComponent;
