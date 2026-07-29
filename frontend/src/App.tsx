import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EmergencyProvider } from './context/EmergencyContext';
import { SidebarNav } from './components/layout/SidebarNav';
import { Header } from './components/layout/Header';
import { EmergencyModal } from './components/EmergencyModal';

// Pages
import { Welcome } from './pages/Welcome';
import { LiveCamera } from './pages/LiveCamera';
import { DriverMonitor } from './pages/DriverMonitor';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { TripHistory } from './pages/TripHistory';
import { NotificationsPage } from './pages/Notifications';
import { SettingsPage } from './pages/Settings';
import { MobileConnect } from './pages/MobileConnect';
import { MobileStreamPage } from './pages/MobileStreamPage';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const getPageTitle = (path: string) => {
    switch (path) {
      case '/live-camera':
        return 'Live AI Camera Stream';
      case '/driver-monitor':
        return 'Driver Fatigue & Drowsiness Monitor';
      case '/dashboard':
        return 'Tactical Dashboard';
      case '/analytics':
        return 'Safety & Hazard Analytics';
      case '/trips':
        return 'Trip Logs & Route Telemetry';
      case '/notifications':
        return 'Hazard Notification Center';
      case '/settings':
        return 'Sensors & AI Settings';
      case '/mobile-connect':
        return 'Mobile Camera Connect & WebRTC';
      default:
        return 'NightVision AI';
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex">
      {/* Sidebar Navigation */}
      <SidebarNav />

      {/* Main Content Viewport */}
      <div className="ml-64 flex-1 flex flex-col min-h-screen">
        <Header title={getPageTitle(location.pathname)} />
        <main className="flex-1 pb-12">{children}</main>
      </div>

      {/* Global Emergency Modal */}
      <EmergencyModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <EmergencyProvider>
      <Routes>
        {/* Launch Page before entering into app */}
        <Route path="/" element={<Welcome />} />
        <Route path="/launch" element={<Welcome />} />

        {/* Standalone Mobile Web App Stream Page */}
        <Route path="/mobile-stream" element={<MobileStreamPage />} />

        {/* Internal Application Pages */}
        <Route path="/live-camera" element={<AppLayout><LiveCamera /></AppLayout>} />
        <Route path="/driver-monitor" element={<AppLayout><DriverMonitor /></AppLayout>} />
        <Route path="/dashboard" element={<AppLayout><Dashboard /></AppLayout>} />
        <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
        <Route path="/trips" element={<AppLayout><TripHistory /></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><NotificationsPage /></AppLayout>} />
        <Route path="/settings" element={<AppLayout><SettingsPage /></AppLayout>} />
        <Route path="/mobile-connect" element={<AppLayout><MobileConnect /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </EmergencyProvider>
  );
};

export default App;
