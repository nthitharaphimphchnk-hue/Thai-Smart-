import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Sell from "./pages/Sell";
import LowStock from "./pages/LowStock";
import Debtors from "./pages/Debtors";
import Products from "./pages/Products";
import Chat from "./pages/Chat";
import Reports from "./pages/Reports";
import StockIn from "./pages/StockIn";
import StockHistory from "./pages/StockHistory";
import Settings from "./pages/Settings";
import FullTaxInvoices from "./pages/FullTaxInvoices";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/sell" component={Sell} />
      <Route path="/low-stock" component={LowStock} />
      <Route path="/debtors" component={Debtors} />
      <Route path="/products" component={Products} />
      <Route path="/stock-in" component={StockIn} />
      <Route path="/stock-history" component={StockHistory} />
      <Route path="/chat" component={Chat} />
      <Route path="/reports" component={Reports} />
      <Route path="/settings" component={Settings} />
      <Route path="/full-tax-invoices" component={FullTaxInvoices} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
