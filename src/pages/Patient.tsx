import { DashboardLayout } from "@/components/DashboardLayout";
import ShowAllPatients from "@/components/patient/ShowAllPatients";

const Patient = () => {
  return (
    <DashboardLayout>
        <div className="space-y-6">
            <ShowAllPatients />
        </div>
    </DashboardLayout>
  );
};

export default Patient;