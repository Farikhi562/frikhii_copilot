import { Link } from "react-router-dom";
import { Mark } from "../components/brand/Mark";
export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (<main className="min-h-screen grid place-items-center p-8"><div className="max-w-md">
    <Mark /><h1 className="mt-10 text-4xl font-semibold tracking-tight">{title}</h1>
    <p className="mt-3 text-ink/70">{note}</p>
    <Link to="/" className="mt-8 inline-block rounded-full bg-ink px-5 py-2.5 text-paper">Back to home</Link></div></main>);
}
