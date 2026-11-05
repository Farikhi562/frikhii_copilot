import { Alert } from "../../../components/ui/Feedback";

export function AuthConfigNotice({ message }: { message: string | null }) {
  return (
    <Alert variant="error" title="Authentication is not connected yet">
      {message ??
        "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local at the repository root, then restart the dev server."}
    </Alert>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="error" title="Could not continue">
      {message}
    </Alert>
  );
}

export function FormNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="success" title="Done">
      {message}
    </Alert>
  );
}
