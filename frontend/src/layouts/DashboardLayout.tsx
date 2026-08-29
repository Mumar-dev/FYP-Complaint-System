import React, { useState } from 'react';
import Navbar from '@components/Common/Navbar';
import Sidebar from '@components/Common/Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-gray-50">
      {/* Fixed Top Navbar */}
      <header className="flex-none h-16 z-30">
        <Navbar onMenuClick={toggleSidebar} sidebarOpen={sidebarOpen} />
      </header>

      {/* Main Body below Navbar: Fixed height, independent column scrolling */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Fixed Desktop Sidebar & Drawer on Mobile */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Right-Side Main Content (Independently Scrolls Vertically) */}
        <main
          className="flex-1 h-full overflow-y-auto bg-gray-50/60 p-4 sm:p-5 lg:p-6 focus:outline-none"
          tabIndex={-1}
        >
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default DashboardLayout;
