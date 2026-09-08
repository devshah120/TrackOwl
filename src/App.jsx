import { Routes, Route, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { TrustedCompanies } from './components/TrustedCompanies';
import { Features } from './components/Features';
import { PremiumFeatures } from './components/PremiumFeatures';
import { ProductShowcaseSection } from './components/ProductShowcaseSection';
import { HowItWorks } from './components/HowItWorks';
import { Testimonials } from './components/Testimonials';
import { Pricing } from './components/Pricing';
import { FAQ } from './components/FAQ';
import { CTA } from './components/CTA';
import { Footer } from './components/Footer';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { DashboardLayout } from './pages/DashboardLayout';
import { TripsAndDocuments } from './pages/TripsAndDocuments';
import { AddNewTrip } from './pages/AddNewTrip';
import { DailyLedger } from './pages/DailyLedger';
import { AddLedgerEntry } from './pages/AddLedgerEntry';
import { FleetAndDrivers } from './pages/FleetAndDrivers';
import { Drivers } from './pages/Drivers';
import { AddNewDriver } from './pages/AddNewDriver';
import { FleetMap } from './pages/FleetMap';
import { TripRoutes } from './pages/TripRoutes';
import { TripManagement } from './pages/TripManagement';
import { TripForm } from './pages/TripForm';
import { TripDetail } from './pages/TripDetail';
import { Customers } from './pages/Customers';
import { CustomerForm } from './pages/CustomerForm';
import { FuelManagement } from './pages/FuelManagement';
import { FuelForm } from './pages/FuelForm';
import { FuelReports } from './pages/FuelReports';
import { FuelSettings } from './pages/FuelSettings';
import { MaintenanceDashboard } from './pages/MaintenanceDashboard';
import { MaintenanceReminders } from './pages/MaintenanceReminders';
import { MaintenanceReports } from './pages/MaintenanceReports';
import { MaintenanceSettings } from './pages/MaintenanceSettings';
import { ServiceRecords } from './pages/ServiceRecords';
import { ServiceForm } from './pages/ServiceForm';
import { RepairRequests } from './pages/RepairRequests';
import { RepairDetail } from './pages/RepairDetail';
import { RepairForm } from './pages/RepairForm';
import { TyreRegister } from './pages/TyreRegister';
import { TyreDetail } from './pages/TyreDetail';
import { BatteryRegister } from './pages/BatteryRegister';
import { BatteryForm } from './pages/BatteryForm';
import { AddNewTruck } from './pages/AddNewTruck';
import { SettingsPage } from './pages/Settings';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminClients } from './pages/admin/AdminClients';
import { AdminFleet } from './pages/admin/AdminFleet';
import { AdminDeviceMaster } from './pages/admin/AdminDeviceMaster';
import { AdminAddDevice } from './pages/admin/AdminAddDevice';
import { AdminLiveTracking } from './pages/admin/AdminLiveTracking';
import { AdminPermissions } from './pages/admin/AdminPermissions';
import { AdminAuditLog } from './pages/admin/AdminAuditLog';

function App() {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/login');
  };

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleBackHome = () => {
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/login" element={<Login onBackHome={handleBackHome} />} />
      <Route path="/forgot-password" element={<ForgotPassword onBackHome={handleBackHome} />} />
      <Route path="/register" element={<Register onBackHome={handleBackHome} />} />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute clientOnly>
            <DashboardLayout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips-and-documents"
        element={
          <ProtectedRoute clientOnly resource="billing">
            <TripsAndDocuments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-trip"
        element={
          <ProtectedRoute clientOnly resource="billing">
            <AddNewTrip />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-trip/:id"
        element={
          <ProtectedRoute clientOnly resource="billing">
            <AddNewTrip />
          </ProtectedRoute>
        }
      />
      <Route
        path="/daily-ledger"
        element={
          <ProtectedRoute clientOnly resource="ledger">
            <DailyLedger />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-ledger-entry"
        element={
          <ProtectedRoute clientOnly resource="ledger">
            <AddLedgerEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-ledger-entry/:id"
        element={
          <ProtectedRoute clientOnly resource="ledger">
            <AddLedgerEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fleet-and-drivers"
        element={
          <ProtectedRoute clientOnly resource="trucks">
            <FleetAndDrivers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/drivers"
        element={
          <ProtectedRoute clientOnly resource="drivers">
            <Drivers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-driver"
        element={
          <ProtectedRoute clientOnly resource="drivers">
            <AddNewDriver />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-driver/:id"
        element={
          <ProtectedRoute clientOnly resource="drivers">
            <AddNewDriver />
          </ProtectedRoute>
        }
      />
      <Route
        path="/live-tracking"
        element={
          <ProtectedRoute clientOnly resource="tracking">
            <FleetMap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trip-routes"
        element={
          <ProtectedRoute clientOnly resource="tracking">
            <TripRoutes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-truck"
        element={
          <ProtectedRoute clientOnly resource="trucks">
            <AddNewTruck />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-new-truck/:id"
        element={
          <ProtectedRoute clientOnly resource="trucks">
            <AddNewTruck />
          </ProtectedRoute>
        }
      />
      {/* Trip Management. Gated on the existing `trips` resource; the
          customer master has its own `customers` resource. */}
      <Route
        path="/trips"
        element={
          <ProtectedRoute clientOnly resource="trips">
            <TripManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/new"
        element={
          <ProtectedRoute clientOnly resource="trips">
            <TripForm />
          </ProtectedRoute>
        }
      />
      {/* Declared before /trips/:id so "new" is never read as an id. */}
      <Route
        path="/trips/:id/edit"
        element={
          <ProtectedRoute clientOnly resource="trips">
            <TripForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trips/:id"
        element={
          <ProtectedRoute clientOnly resource="trips">
            <TripDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute clientOnly resource="customers">
            <Customers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/new"
        element={
          <ProtectedRoute clientOnly resource="customers">
            <CustomerForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute clientOnly resource="customers">
            <CustomerForm />
          </ProtectedRoute>
        }
      />
      {/* Fuel Management. Gated on its own `fuel` resource: fuelling is
          vehicle-centric, and a fuel clerk should not imply a dispatcher. */}
      <Route
        path="/fuel"
        element={
          <ProtectedRoute clientOnly resource="fuel">
            <FuelManagement />
          </ProtectedRoute>
        }
      />
      {/* Declared before /fuel/:id so "new", "reports" and "settings" are
          never read as entry ids. */}
      <Route
        path="/fuel/new"
        element={
          <ProtectedRoute clientOnly resource="fuel">
            <FuelForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fuel/reports"
        element={
          <ProtectedRoute clientOnly resource="fuel">
            <FuelReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fuel/settings"
        element={
          <ProtectedRoute clientOnly resource="fuel">
            <FuelSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fuel/:id"
        element={
          <ProtectedRoute clientOnly resource="fuel">
            <FuelForm />
          </ProtectedRoute>
        }
      />
      {/* Maintenance Management. Gated on its own `maintenance` resource:
          maintenance is vehicle-centric like fuel, and a workshop clerk who
          books job cards has no business editing the fleet register itself.

          The static segments are all declared before their `:id` siblings, so
          "new", "reports" and "settings" are never read as record ids. */}
      <Route
        path="/maintenance"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <MaintenanceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/reminders"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <MaintenanceReminders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/reports"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <MaintenanceReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/settings"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <MaintenanceSettings />
          </ProtectedRoute>
        }
      />

      {/* M3-M02 — service records */}
      <Route
        path="/maintenance/services"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <ServiceRecords />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/services/new"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <ServiceForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/services/:id"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <ServiceForm />
          </ProtectedRoute>
        }
      />

      {/* M3-M04 / M3-M05 — repairs. The detail screen is where a job moves
          through its workflow, so it is the landing page rather than the form. */}
      <Route
        path="/maintenance/repairs"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <RepairRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/repairs/new"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <RepairForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/repairs/:id/edit"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <RepairForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/repairs/:id"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <RepairDetail />
          </ProtectedRoute>
        }
      />

      {/* M3-M06 to M3-M09 — the tyre and battery masters. Both sit behind the
          same `maintenance` resource as the job cards. */}
      <Route
        path="/maintenance/tyres"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <TyreRegister />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/tyres/:id"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <TyreDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/batteries"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <BatteryRegister />
          </ProtectedRoute>
        }
      />
      <Route
        path="/maintenance/batteries/:id"
        element={
          <ProtectedRoute clientOnly resource="maintenance">
            <BatteryForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/overview"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminOverview />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/clients"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminClients />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fleet"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminFleet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/devices"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminDeviceMaster />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-device"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminAddDevice />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-device/:id"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminAddDevice />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/live-tracking"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminLiveTracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/permissions"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminPermissions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute requireSuperAdmin>
            <AdminAuditLog />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={
          <div className="bg-white overflow-hidden">
            <Navbar onSignIn={handleSignIn} onGetStarted={handleGetStarted} />
            <Hero onSignIn={handleSignIn} onGetStarted={handleGetStarted} />
            <TrustedCompanies />
            <Features />
            <ProductShowcaseSection />
            <HowItWorks />
            <Testimonials />
            <Pricing />
            <FAQ />
            <CTA onSignIn={handleSignIn} onGetStarted={handleGetStarted} />
            <Footer />
          </div>
        }
      />
    </Routes>
  );
}

export default App;
