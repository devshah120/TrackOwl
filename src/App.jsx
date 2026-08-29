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
import { FleetMap } from './pages/FleetMap';
import { TripRoutes } from './pages/TripRoutes';
import { AddNewTruck } from './pages/AddNewTruck';
import { SettingsPage } from './pages/Settings';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminClients } from './pages/admin/AdminClients';
import { AdminFleet } from './pages/admin/AdminFleet';
import { AdminLiveTracking } from './pages/admin/AdminLiveTracking';
import { AdminPermissions } from './pages/admin/AdminPermissions';

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
