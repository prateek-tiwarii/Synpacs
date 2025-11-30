import { useUser } from '@/hooks/useUser';  
import CoordinatorDashboard from '@/components/dashboard/coordinatorDashboard/coordinatorDashboard';
import DoctorDashboard from '@/components/dashboard/doctorDashboard/doctorDashboard';

const Dashboard = () => {
  const { role, loading } = useUser()

  // Handle loading state to prevent hydration mismatch
  if (loading || !role || role === 'N/A') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6 space-y-6">
        <div>Loading...</div>
      </div>
    );
  }

  const DashboardToRender = () => {
    switch (role) {
      case 'doctor':
        return <DoctorDashboard />
      case 'coordinator':
      case 'super_coordinator':
        return <CoordinatorDashboard />
      default:
        return <div>No User found</div>
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-2 space-y-6">
      {DashboardToRender()}
    </div>
  );
};

export default Dashboard;