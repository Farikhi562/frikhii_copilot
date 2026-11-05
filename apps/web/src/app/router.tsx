import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Placeholder from "../pages/Placeholder";
import Landing from "../pages/Landing";
import { FullPageLoader } from "../components/system/RouteStates";
import { ProtectedRoute, PublicOnlyRoute } from "./guards";

// Landing is eager so the public page paints immediately; everything behind a
// route is split so the Supabase client and form libraries are not in the
// first payload.
const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const ForgotPassword = lazy(() => import("../pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../pages/auth/ResetPassword"));
const AuthCallback = lazy(() => import("../pages/auth/AuthCallback"));
const AppLayout = lazy(() => import("../pages/app/AppLayout"));
const Dashboard = lazy(() => import("../pages/app/Dashboard"));
const Courses = lazy(() => import("../pages/app/Courses"));
const NewCourse = lazy(() => import("../pages/app/NewCourse"));
const Diagnostic = lazy(() => import("../pages/app/Diagnostic"));
const DiagnosticResult = lazy(() => import("../pages/app/DiagnosticResult"));
const Generating = lazy(() => import("../pages/app/Generating"));
const CourseReview = lazy(() => import("../pages/app/CourseReview"));
const CourseDetail = lazy(() => import("../pages/app/CourseDetail"));
const AppSettings = lazy(() => import("../pages/app/Settings"));
const ComponentGallery = lazy(() => import("../pages/ComponentGallery"));

const placeholder = (title: string, note: string) => <Placeholder title={title} note={note} />;

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
      <Route path="/" element={<Landing />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="courses/new" element={<NewCourse />} />
          <Route path="courses/:courseId" element={<CourseDetail />} />
          <Route path="courses/:courseId/review" element={<CourseReview />} />
          <Route path="goals/:goalId/diagnostic" element={<Diagnostic />} />
          <Route path="goals/:goalId/result" element={<DiagnosticResult />} />
          <Route path="goals/:goalId/generating" element={<Generating />} />
          <Route path="settings" element={<AppSettings />} />
        </Route>
      </Route>

      <Route
        path="/privacy"
        element={placeholder(
          "Privacy",
          "A privacy policy will be published before any public launch. Phase 02 stores only your name, email and learning preferences in Supabase.",
        )}
      />
      <Route
        path="/terms"
        element={placeholder("Terms", "Terms of use will be published before public launch.")}
      />
      <Route
        path="/contact"
        element={placeholder("Contact", "Contact details will be added before public launch.")}
      />
      {import.meta.env.DEV && <Route path="/dev/components" element={<ComponentGallery />} />}
      <Route
        path="*"
        element={placeholder("Page not found", "This page does not exist.")}
      />
      </Routes>
    </Suspense>
  );
}
