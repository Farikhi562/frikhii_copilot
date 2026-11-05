import { create } from "zustand";

type ToastItem = { id: number; text: string };
type ToastStore = { items: ToastItem[]; push: (text: string) => void; drop: (id: number) => void };

const useToasts = create<ToastStore>((set, get) => ({
  items: [],
  drop: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  push: (text) => {
    const id = Date.now() + Math.random();
    set((s) => ({ items: [...s.items, { id, text }] }));
    setTimeout(() => get().drop(id), 4000);
  },
}));

export const toast = (text: string) => useToasts.getState().push(text);

export function Toaster() {
  const items = useToasts((s) => s.items);
  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 space-y-2">
      {items.map((i) => (
        <p key={i.id} className="rounded-xl bg-ink px-4 py-3 text-paper">{i.text}</p>
      ))}
    </div>
  );
}
