import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import StudentLoginPage from "./pages/StudentLoginPage";
import AdminDashboardShell from "./components/admin/AdminDashboardShell";
import StudentDashboardShell from "./components/student/StudentDashboardShell";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login/admin" element={<AdminLoginPage />} />
          <Route path="/login/student" element={<StudentLoginPage />} />
          <Route path="/admin/*" element={<AdminDashboardShell />} />
          <Route path="/student/*" element={<StudentDashboardShell />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
