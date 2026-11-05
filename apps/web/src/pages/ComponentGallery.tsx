import { useState, type ReactNode } from "react";
import { Home, BookOpen, Settings } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Field } from "../components/ui/Field";
import { Avatar, Checkbox, Radio, Select, Switch, Textarea } from "../components/ui/Form";
import { Alert, Badge, EmptyState, ErrorState, ProgressBar, ProgressRing, Skeleton, Spinner } from "../components/ui/Feedback";
import { Dialog } from "../components/ui/Dialog";
import { ConfirmDialog, DropdownMenu, Popover, Tooltip } from "../components/ui/Overlay";
import { Breadcrumb, Sidebar, Tabs, Topbar } from "../components/ui/Nav";
import { Card, ContentGrid, PageContainer, SectionHeader, StatCard } from "../components/ui/Layout";
import { toast, Toaster } from "../components/ui/Toast";
function Demo({ name, usage, snippet, children }: { name: string; usage: string; snippet: string; children: ReactNode }) {
  return (<Card><h3 className="font-semibold">{name}</h3><p className="text-sm text-ink/65">{usage}</p><div className="my-4 flex flex-wrap items-start gap-4">{children}</div>
    <code className="block overflow-x-auto rounded-lg bg-ink p-3 font-mono text-xs text-paper">{snippet}</code></Card>);
}
export default function ComponentGallery() {
  const [open, setOpen] = useState(false), [confirm, setConfirm] = useState(false);
  const [on, setOn] = useState(true), [checked, setChecked] = useState(false), [radio, setRadio] = useState("a");
  const [pct, setPct] = useState(40), [picked, setPicked] = useState("None"), [tab, setTab] = useState("one"), [count, setCount] = useState(0);
  const nav = [{ to: "/app", label: "Dashboard", icon: <Home className="h-4 w-4" /> }, { to: "/app/courses", label: "Courses", icon: <BookOpen className="h-4 w-4" /> }, { to: "/app/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> }];
  return (<PageContainer><SectionHeader title="Components (dev only)" description="Interactive gallery. Not part of the public product." />
    <ContentGrid cols={2}>
      <Demo name="Button" usage="Actions. Variants, loading, disabled." snippet={`<Button variant="accent">Save</Button>`}>
        <Button onClick={() => setCount(count + 1)}>Clicked {count}</Button><Button variant="accent">Accent</Button><Button variant="ghost">Ghost</Button><Button loading>Loading</Button><Button disabled>Disabled</Button></Demo>
      <Demo name="Field / Textarea / Select" usage="Labelled inputs with error state." snippet={`<Field label="Email" error="Required" />`}>
        <Field label="Email" /><Field label="Name" error="Name is required." /><Field label="Disabled" disabled /><Textarea label="Goal" error="Describe your goal." /><Select label="Level" options={[{ value: "b", label: "Beginner" }, { value: "i", label: "Intermediate" }]} /></Demo>
      <Demo name="Checkbox / Radio / Switch" usage="Choices. Fully keyboard operable." snippet={`<Switch checked={on} onCheckedChange={setOn} label="Reminders" />`}>
        <Checkbox label="Accept" checked={checked} onChange={(e) => setChecked(e.target.checked)} /><Checkbox label="Disabled" disabled />
        <Radio name="r" label="A" checked={radio === "a"} onChange={() => setRadio("a")} /><Radio name="r" label="B" checked={radio === "b"} onChange={() => setRadio("b")} />
        <Switch checked={on} onCheckedChange={setOn} label={on ? "On" : "Off"} /><Switch checked={false} onCheckedChange={() => {}} label="Disabled" disabled /></Demo>
      <Demo name="Avatar / Badge / Tooltip" usage="Identity and status." snippet={`<Avatar name="Ada Lovelace" />`}>
        <Avatar name="Ada Lovelace" /><Badge>Beta</Badge><Tooltip text="Tooltip text"><Button variant="ghost">Hover or focus</Button></Tooltip></Demo>
      <Demo name="Alert" usage="Four variants." snippet={`<Alert variant="warning" title="Heads up" />`}>
        <div className="grid w-full gap-2"><Alert title="Info">Information.</Alert><Alert variant="success" title="Success" /><Alert variant="warning" title="Warning" /><Alert variant="error" title="Error">Something failed.</Alert></div></Demo>
      <Demo name="Progress" usage="Bar and ring respond to value." snippet={`<ProgressRing value={pct} />`}>
        <ProgressRing value={pct} /><div className="w-40 pt-4"><ProgressBar value={pct} /></div><Button variant="ghost" onClick={() => setPct((pct + 20) % 120)}>+20</Button></Demo>
      <Demo name="Loading / Empty / Error" usage="Standard states." snippet={`<EmptyState title="No courses" hint="..." />`}>
        <Spinner /><Skeleton className="h-6 w-32" /><div className="w-full"><EmptyState title="No courses yet" hint="Course Architect arrives later." /></div><div className="w-full"><ErrorState title="Could not load" hint="Try again." /></div></Demo>
      <Demo name="Dialog / Confirm / Toast" usage="Overlays with focus trap and Escape." snippet={`<ConfirmDialog open onConfirm={...} />`}>
        <Button onClick={() => setOpen(true)}>Dialog</Button><Button variant="ghost" onClick={() => setConfirm(true)}>Confirm</Button><Button variant="accent" onClick={() => toast("Saved")}>Toast</Button></Demo>
      <Demo name="Dropdown / Popover" usage={`Selected: ${picked}`} snippet={`<DropdownMenu trigger={...} items={[...]} />`}>
        <DropdownMenu trigger={<Button variant="ghost">Menu</Button>} items={[{ label: "Alpha", onSelect: () => setPicked("Alpha") }, { label: "Beta", onSelect: () => setPicked("Beta") }, { label: "Disabled", onSelect: () => {}, disabled: true }]} />
        <Popover trigger={<Button variant="ghost">Popover</Button>}><p>Popover content. Press Escape to close.</p></Popover></Demo>
      <Demo name="Tabs / Breadcrumb" usage="Switch content; show location." snippet={`<Tabs tabs={[...]} />`}>
        <div className="w-full space-y-4"><Breadcrumb items={[{ label: "Home", to: "/" }, { label: "Courses", to: "/app/courses" }, { label: "Lesson" }]} />
          <Tabs value={tab} onValueChange={setTab} tabs={[{ value: "one", label: "One", content: "First panel" }, { value: "two", label: "Two", content: "Second panel" }]} /></div></Demo>
      <Demo name="Sidebar / Topbar" usage="Shell navigation. Sidebar hides below md; Topbar shows a menu button there." snippet={`<Sidebar items={nav} />`}>
        <div className="w-full rounded-xl border border-ink/15"><Topbar title="Preview" onMenu={() => toast("Menu button pressed")} /><div className="flex gap-4 p-4"><Sidebar items={nav} /><p className="text-sm text-ink/65">Resize below 768px to see the sidebar collapse.</p></div></div></Demo>
      <Demo name="Card / StatCard / Grid" usage="Layout primitives." snippet={`<StatCard label="Progress" value="64%" progress={64} />`}>
        <div className="w-full"><ContentGrid cols={2}><StatCard label="Demo progress" value="64%" progress={64} /><Card>Plain card</Card></ContentGrid></div></Demo>
    </ContentGrid>
    <Dialog open={open} onOpenChange={setOpen} title="Dialog" description="Demonstration dialog."><Button onClick={() => setOpen(false)}>Close</Button></Dialog>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Confirm action" description="This does nothing." onConfirm={() => toast("Confirmed")} />
    <Toaster /></PageContainer>);
}
