import { create } from "zustand";

const KEY = "frikhii.sidebar.collapsed";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function write(value: boolean) {
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable: the preference simply is not remembered */
  }
}

type ShellState = { collapsed: boolean; setCollapsed: (value: boolean) => void; toggle: () => void };

/** Sidebar collapse preference. Stored on this device only (localStorage), not in the account. */
export const useShellStore = create<ShellState>((set, get) => ({
  collapsed: read(),
  setCollapsed: (value) => {
    write(value);
    set({ collapsed: value });
  },
  toggle: () => get().setCollapsed(!get().collapsed),
}));
