
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import CommissioningStatusPage from './CommissioningStatusPage';
import CommissioningDashboard from './CommissioningDashboard';
import CEODashboard from './CEODashboard';
import MasterDataTable from './MasterDataTable';
import SolarStatusPage from './SolarStatusPage';
import WindStatusPage from './WindStatusPage';
import ChatbotPanel from './ChatbotPanel';
import UserManual from './UserManual';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { parseScopeString, getCurrentFiscalYear } from '../lib/utils';

const ApplicationPage = () => {
  const [activePage, setActivePage] = useState('ceo');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [theme, setTheme] = useState('light');
  const [fiscalYear, setFiscalYear] = useState(getCurrentFiscalYear());
  const [fyDropdownOpen, setFyDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { user, logout, isLoading: isAuthLoading, isViewer, isEditor, isAdmin, isSuperAdmin, canEdit, canAccessAdmin } = useAuth();
  const navigate = useNavigate();

  // Standardized Scope Parsing
  const userScope = useMemo(() => parseScopeString(user?.scope || 'all'), [user]);

  // Redirect away from restricted pages if scope changes
  useEffect(() => {
    if (activePage === 'solar' && userScope.category === 'wind') {
      setActivePage('dashboard');
    }
    if (activePage === 'wind' && userScope.category === 'solar') {
      setActivePage('dashboard');
    }
  }, [activePage, userScope]);

  // NOTE: Viewer mode - no login required to view the application
  // Users can optionally log in via the header button for elevated access



  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Theme management
  useEffect(() => {
    // Check system preference or saved theme
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
      setTheme(savedTheme);
    } else if (systemPrefersDark) {
      setTheme('dark');
    }

    // Apply theme to document
    if (theme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  // If user is not authenticated, redirect them to SSO
  // (This allows the /application route to be protected)
  useEffect(() => {
    if (!isAuthLoading && !user) {
      // Give a brief moment to check auth state (SSO is disabled, redirect to login)
      const timer = setTimeout(() => {
        if (!user) {
          navigate('/login');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthLoading, user, navigate]);

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  // If no user is logged in, do not render the rest of the application.
  // The useEffect above will handle redirecting the user to the SSO login.
  if (!user) return <div className="h-screen flex items-center justify-center text-gray-500">Redirecting to login...</div>;

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = () => {
    logout();
    // Redirect to home page using the correct base path
    window.location.href = import.meta.env.BASE_URL;
  };

  // Format date and time
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Define sidebar items with icons
  const sidebarItems = [
    {
      id: 'home',
      name: 'Home',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      ),
      href: '/'
    },
    {
      id: 'ceo',
      name: 'CEO Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      href: undefined,
      color: 'text-[#0B74B0]'
    },
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      ),
      href: undefined
    },
    {
      id: 'solar',
      name: 'Solar',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
        </svg>
      ),
      href: undefined,
      color: 'text-[#0B74B0]'
    },
    {
      id: 'wind',
      name: 'Wind',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      ),
      href: undefined,
      color: 'text-cyan-500'
    },
    {
      id: 'masterdata',
      name: 'Master Data',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5 4a3 3 0 00-3 3v6a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3H5zm-1 9v-1h5v2H5a1 1 0 01-1-1zm7 1h4a1 1 0 001-1v-1h-5v2zm0-4h5V8h-5v2zM9 8H4v2h5V8z" clipRule="evenodd" />
        </svg>
      ),
      href: undefined
    },
    {
      id: 'usermanual',
      name: 'User Manual',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      ),
      href: undefined,
      color: 'text-[#0B74B0]'
    },
  ].filter(item => {
    // Scope-based filtering (solar-only / wind-only users)
    if (item.id === 'solar' && userScope.category === 'wind') return false;
    if (item.id === 'wind' && userScope.category === 'solar') return false;

    // Role-based filtering
    // SUPER_ADMIN (CEO): sees Home, CEO Dashboard, Dashboard, Solar, Wind, User Manual — NO Master Data
    if (isSuperAdmin) {
      if (item.id === 'masterdata') return false;
    }

    // VIEWER: sees all dashboards (read-only) but no Master Data
    if (isViewer) {
      if (item.id === 'masterdata') return false;
    }

    // EDITOR: sees dashboards + Master Data
    // ADMIN: sees everything
    return true;
  });

  // Define page content based on active page
  const renderPageContent = () => {
    switch (activePage) {
      case 'ceo':
        return <CEODashboard fiscalYear={fiscalYear} />;
      case 'dashboard':
        return <CommissioningDashboard fiscalYear={fiscalYear} />;
      case 'solar':
        return <SolarStatusPage fiscalYear={fiscalYear} />;
      case 'wind':
        return <WindStatusPage fiscalYear={fiscalYear} />;
      case 'masterdata':
        return <MasterDataTable fiscalYear={fiscalYear} setFiscalYear={setFiscalYear} />;
      case 'commissioning':
        return <CommissioningStatusPage fiscalYear={fiscalYear} />;
      case 'usermanual':
        return <UserManual />;
      default:
        return <CommissioningDashboard fiscalYear={fiscalYear} />;
    }
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-[#171717] flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="bg-white dark:bg-[#171717] shadow-sm p-2 sm:p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 flex-shrink-0 relative z-[20]">
        <div className="flex items-center gap-2">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <img
            src={`${import.meta.env.BASE_URL}adani-re.png`}
            alt="Adani Logo"
            className="h-8 sm:h-12 lg:h-14 ml-1 sm:ml-4 object-contain"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date/Time - hidden on very small screens */}
          <div className="hidden sm:block text-right">
            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white" suppressHydrationWarning>{formatDate(currentTime)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400" suppressHydrationWarning>{formatTime(currentTime)}</div>
          </div>

          {/* Global Fiscal Year Selector */}
          <div className="relative">
            <button
              onClick={() => setFyDropdownOpen(!fyDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-800/30 transition-all group"
            >
              <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">FY</span>
              <span className="text-sm font-bold text-gray-800 dark:text-white">
                {fiscalYear === 'all' ? 'ALL' : fiscalYear.replace('FY_', '20')}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${fyDropdownOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {fyDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-[90]"
                  onClick={() => setFyDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-32 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-1 overflow-hidden z-[100] animate-in zoom-in-95 duration-200">
                  {[
                    { id: 'all', label: 'All Years' },
                    { id: `FY_${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) - 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) - 1}`, label: `20${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) - 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) - 1}` },
                    { id: getCurrentFiscalYear(), label: `20${getCurrentFiscalYear().split('_')[1]}` },
                    { id: `FY_${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) + 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) + 1}`, label: `20${parseInt(getCurrentFiscalYear().split('_')[1].split('-')[0]) + 1}-${parseInt(getCurrentFiscalYear().split('-')[1]) + 1}` }
                  ].map((fy) => (
                    <button
                      key={fy.id}
                      onClick={() => {
                        setFiscalYear(fy.id);
                        setFyDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-bold transition-colors ${fiscalYear === fy.id
                        ? 'bg-orange-50 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                      {fy.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {user ? (
            <div className="relative group z-[100]">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {/* User Avatar */}
                <div className="w-8 h-8 rounded-full bg-[#0B74B0] flex items-center justify-center text-white font-bold text-sm">
                  {user.username ? user.username.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                {/* User Name - hidden on mobile */}
                <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                  {user.username || user.email?.split('@')[0] || 'User'}
                </span>
                {/* Role badge */}
                <span className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${isSuperAdmin ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' :
                  isAdmin ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                    isEditor ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}>
                  {user.role === 'SUPER_ADMIN' ? 'CEO' : user.role}
                </span>
                {/* Dropdown Arrow */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                    {user.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email || ''}
                  </p>
                  <p className="text-[10px] font-bold text-[#0B74B0] dark:text-[#4DA8D8] mt-1 uppercase">
                    {user.role === 'SUPER_ADMIN' ? 'CEO / Super Admin' : user.role}
                  </p>
                </div>
                <div className="p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#0B74B0] text-white rounded-lg hover:bg-[#095a87] font-medium text-xs sm:text-sm"
            >
              Sign In
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-[45] lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            ${sidebarCollapsed && !sidebarHovered ? 'w-[68px] lg:w-[68px]' : 'w-64'} bg-white dark:bg-[#171717] shadow-lg lg:shadow-md
            transform transition-all duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            flex flex-col border-r border-gray-200 dark:border-gray-700
          `}
          onMouseEnter={() => setSidebarHovered(true)}
          onMouseLeave={() => setSidebarHovered(false)}
        >
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-end p-2">
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-2.5 flex flex-col flex-1 overflow-hidden">
            <nav className="flex-1">
              <ul className="space-y-0.5">
                {sidebarItems.map((item) => {
                  const isCollapsed = sidebarCollapsed && !sidebarHovered;
                  const isActive = activePage === item.id;

                  const content = (
                    <>
                      <span className={`flex items-center justify-center flex-shrink-0 w-9 h-9 rounded-lg transition-colors ${isActive ? 'bg-[#0B74B0]/15 text-[#0B74B0]' : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {item.icon}
                      </span>
                      <span className={`ml-3 text-sm font-medium whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100 w-auto'
                        }`}>
                        {item.name}
                      </span>
                    </>
                  );

                  return (
                    <li key={item.id} className="relative group">
                      {item.href ? (
                        <Link
                          to={item.href}
                          className={`w-full text-left px-2 py-2 rounded-lg flex items-center transition-colors ${isActive
                            ? 'bg-[#0B74B0]/10 text-[#0B74B0] dark:text-[#4DA8D8] font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {content}
                        </Link>
                      ) : (
                        <button
                          onClick={() => {
                            setActivePage(item.id);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left px-2 py-2 rounded-lg flex items-center transition-colors ${isActive
                            ? 'bg-[#0B74B0]/10 text-[#0B74B0] dark:text-[#4DA8D8] font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                          {content}
                        </button>
                      )}
                      {/* Tooltip when collapsed */}
                      {isCollapsed && (
                        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-[100] pointer-events-none">
                          {item.name}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
          <div className="p-3 sm:p-4 lg:p-6 pb-20 mt-4">
            {renderPageContent()}
          </div>
        </div>
      </div>
      <ChatbotPanel />
    </div>
  );
};

export default ApplicationPage;