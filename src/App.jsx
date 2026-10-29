import { Toaster } from "@/components/ui/toaster"
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClientInstance } from '@/lib/query-client'
import { queryPersister } from '@/lib/query-persister'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { ThemeProvider } from 'next-themes';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { RequireOwner, RequireModule, RequirePlan } from '@/components/RequireAccess';
import { SubscriptionProvider } from '@/lib/SubscriptionContext';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const POS = lazy(() => import('@/pages/POS'));
const Inventory = lazy(() => import('@/pages/Inventory'));
const CashUp = lazy(() => import('@/pages/CashUp'));
const DailySales = lazy(() => import('@/pages/DailySales'));
const Banking = lazy(() => import('@/pages/Banking'));
const Accounting = lazy(() => import('@/pages/Accounting'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const Customers = lazy(() => import('@/pages/Customers'));
const DebtorsControl = lazy(() => import('@/pages/DebtorsControl'));
const Employees = lazy(() => import('@/pages/Employees'));
const Reports = lazy(() => import('@/pages/Reports'));
const Academy = lazy(() => import('@/pages/Academy'));
const Calculators = lazy(() => import('@/pages/Calculators'));
const SpazaCoach = lazy(() => import('@/pages/SpazaCoach'));
const FundingHub = lazy(() => import('@/pages/FundingHub'));
const MySpazaCard = lazy(() => import('@/pages/MySpazaCard'));
const Settings = lazy(() => import('@/pages/Settings'));
const EmailEvents = lazy(() => import('@/pages/EmailEvents'));
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite'));
const AcceptGroupInvite = lazy(() => import('@/pages/AcceptGroupInvite'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  useEffect(() => {
    if (authError && authError.type === 'auth_required') {
      navigateToLogin();
    }
  }, [authError, navigateToLogin]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-green-50">
        <div className="text-center">
          <img src="/brand/logo.png" alt="My Spaza" className="w-20 h-20 rounded-2xl object-cover mx-auto mb-2" />
          <p className="text-sm font-semibold text-green-700 mb-4">My Spaza</p>
          <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-green-700 mt-3 font-medium">Loading My Spaza...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-green-50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-green-700 mt-3 font-medium">Redirecting to login...</p>
          </div>
        </div>
      );
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Invitation link from the owner's email: works signed out. */}
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/invite/group/:token" element={<AcceptGroupInvite />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pos" element={<RequireModule module="pos"><POS /></RequireModule>} />
            <Route path="/inventory" element={<RequireModule module="inventory"><Inventory /></RequireModule>} />
            <Route path="/cashup" element={<RequireModule module="cashup"><CashUp /></RequireModule>} />
            <Route path="/daily-sales" element={<RequireModule module="daily_sales"><DailySales /></RequireModule>} />
            {/* Premium and Ultra screens stay in the menu for everyone; a shop
                below the plan sees the upgrade overlay in place of the page. */}
            <Route path="/banking" element={<RequireModule module="banking"><RequirePlan feature="banking"><Banking /></RequirePlan></RequireModule>} />
            <Route path="/accounting" element={<RequireModule module="accounting"><RequirePlan feature="accounting"><Accounting /></RequirePlan></RequireModule>} />
            <Route path="/expenses" element={<RequireModule module="expenses"><Expenses /></RequireModule>} />
            <Route path="/suppliers" element={<RequireModule module="suppliers"><Suppliers /></RequireModule>} />
            <Route path="/customers" element={<RequireModule module="customers"><RequirePlan feature="customers"><Customers /></RequirePlan></RequireModule>} />
            <Route path="/debtors" element={<RequireModule module="debtors"><RequirePlan feature="debtors"><DebtorsControl /></RequirePlan></RequireModule>} />
            <Route path="/employees" element={<RequireOwner><RequirePlan feature="employees"><Employees /></RequirePlan></RequireOwner>} />
            <Route path="/reports" element={<RequireModule module="reports"><RequirePlan feature="reports"><Reports /></RequirePlan></RequireModule>} />
            <Route path="/academy" element={<RequireModule module="academy"><Academy /></RequireModule>} />
            <Route path="/calculators" element={<RequireModule module="calculators"><Calculators /></RequireModule>} />
            <Route path="/coach" element={<RequireModule module="coach"><RequirePlan feature="coach"><SpazaCoach /></RequirePlan></RequireModule>} />
            <Route path="/funding" element={<RequireModule module="funding"><FundingHub /></RequireModule>} />
            <Route path="/myspaza-card" element={<RequireModule module="myspaza_card"><MySpazaCard /></RequireModule>} />
            <Route path="/settings" element={<RequireOwner><Settings /></RequireOwner>} />
            <Route path="/admin/email-events" element={<EmailEvents />} />
          </Route>
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <PersistQueryClientProvider
          client={queryClientInstance}
          persistOptions={{ persister: queryPersister, maxAge: 1000 * 60 * 60 * 24 * 7, buster: 'v2' }}
        >
          {/* The shop's plan, plus the simulated checkout modal every paywall
              can open. */}
          <SubscriptionProvider>
            <Router>
              <ScrollToTop />
              <AuthenticatedApp />
            </Router>
          </SubscriptionProvider>
          <Toaster />
        </PersistQueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App