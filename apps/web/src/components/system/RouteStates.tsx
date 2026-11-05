import { Link } from "react-router-dom";
import { Mark } from "../brand/Mark";
import { Spinner } from "../ui/Feedback";

export function FullPageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6">
      <div className="flex items-center gap-3 text-ink/65">
        <Spinner />
        <p className="text-sm">{label}</p>
      </div>
    </main>
  );
}

export function ConfigMissingPage({ message }: { message: string | null }) {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-6 py-16">
      <div className="w-full max-w-lg">
        <Link to="/" aria-label="FRIKHII home">
          <Mark />
        </Link>
        <h1 className="mt-10 text-3xl font-semibold tracking-tight">
          Supabase needs to be connected.
        </h1>
        <p className="mt-3 text-ink/70">
          {message ??
            "Add the project URL and publishable key to your local environment, then restart the dev server."}
        </p>
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-ink p-4 font-mono text-xs leading-6 text-paper">
          <code>{`# .env.local at the repository root\nVITE_SUPABASE_URL=https://<project-ref>.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>\nVITE_CORE_API_URL=http://localhost:8080`}</code>
        </pre>
        <p className="mt-4 text-sm text-ink/55">
          See <span className="font-mono">docs/SUPABASE_SETUP.md</span> for the full setup. Never
          put a service-role key in the frontend.
        </p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-ink px-5 py-2.5 text-paper">
          Back to home
        </Link>
      </div>
    </main>
  );
}
