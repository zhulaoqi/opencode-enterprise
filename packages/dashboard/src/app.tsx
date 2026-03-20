import { Router, Route } from "@solidjs/router"
import { lazy, Suspense } from "solid-js"
import { ThemeProvider } from "./stores/theme"
import { AuthGuard } from "./lib/auth"
import { Layout } from "./components/layout/Layout"

const Login = lazy(() => import("./pages/Login"))
const Chat = lazy(() => import("./pages/Chat"))
const McpMarket = lazy(() => import("./pages/McpMarket"))
const McpDetail = lazy(() => import("./pages/McpDetail"))
const Dashboard = lazy(() => import("./pages/Dashboard"))
const Users = lazy(() => import("./pages/Users"))
const Quotas = lazy(() => import("./pages/Quotas"))
const Audit = lazy(() => import("./pages/Audit"))
const Settings = lazy(() => import("./pages/Settings"))
const Models = lazy(() => import("./pages/Models"))
const Workers = lazy(() => import("./pages/Workers"))
const NotFound = lazy(() => import("./pages/NotFound"))

export function App() {
  return (
    <ThemeProvider>
      <Router
        root={(props) => (
          <Suspense fallback={<div class="flex items-center justify-center min-h-screen">加载中...</div>}>
            {props.children}
          </Suspense>
        )}
      >
        <Route path="/login" component={Login} />
        <Route path="/" component={AuthGuard}>
          <Route path="/" component={Layout}>
            <Route path="/" component={Chat} />
            <Route path="/mcp" component={McpMarket} />
            <Route path="/mcp/:id" component={McpDetail} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/admin/users" component={Users} />
            <Route path="/admin/quotas" component={Quotas} />
            <Route path="/admin/audit" component={Audit} />
            <Route path="/admin/models" component={Models} />
            <Route path="/admin/workers" component={Workers} />
            <Route path="/settings" component={Settings} />
          </Route>
        </Route>
        <Route path="*" component={NotFound} />
      </Router>
    </ThemeProvider>
  )
}
