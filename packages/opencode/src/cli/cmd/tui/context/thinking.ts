import { createMemo, type Setter } from "solid-js"
import { useKV } from "./kv"

export type ThinkingMode = "collapsed" | "hidden"
export type CommandMode = "collapsed" | "hidden"

const MODES: readonly ThinkingMode[] = ["collapsed", "hidden"] as const
const COMMAND_MODES: readonly CommandMode[] = ["collapsed", "hidden"] as const

// OpenAI's Responses API surfaces reasoning summaries that start with a bolded
// title block: "**Inspecting PR workflow**\n\n<body>". Treat that first block,
// or a complete title still awaiting its body while streaming, as disclosure
// metadata so the TUI can style its header independently from the markdown body.
export function reasoningSummary(text: string) {
  const content = text.trim()
  const match = content.match(/^\*\*([^*\n]+)\*\*(?:\r?\n\r?\n|$)/)
  if (!match) return { title: null, body: content }
  return { title: match[1].trim(), body: content.slice(match[0].length).trimEnd() }
}

export function isThinkingMode(value: unknown): value is ThinkingMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value)
}

function normalizeThinkingMode(value: unknown): ThinkingMode {
  if (isThinkingMode(value)) return value
  if (value === false) return "hidden"
  return "collapsed"
}

export function nextThinkingMode(current: ThinkingMode): ThinkingMode {
  const idx = MODES.indexOf(current)
  return MODES[(idx + 1) % MODES.length] ?? "collapsed"
}

export function useThinkingMode() {
  const kv = useKV()
  // Capture pre-state before `kv.signal` seeds a default, so we can detect
  // first-time users with a legacy `thinking_visibility` boolean and migrate.
  // The KVProvider only renders children once kv.ready, so reads here are safe.
  const hadStored = kv.get("thinking_mode") !== undefined
  const legacy = kv.get("thinking_visibility")
  const [stored, setStored] = kv.signal<ThinkingMode | "show" | "hide" | "minimal">("thinking_mode", "collapsed")

  // The kv signal exposes its setter typed as `Setter<T>` which carries Solid's
  // overload set; passing an updater fn through a property access loses the
  // bivariance trick the existing `setX((prev) => ...)` callsites rely on.
  // Wrap it in a sane shape so consumers can just call `set(next)` or pass
  // an updater.
  const set = (next: ThinkingMode | ((prev: ThinkingMode) => ThinkingMode)) => {
    if (typeof next === "function") setStored((prev) => next(normalizeThinkingMode(prev)))
    else setStored(() => next)
  }

  // New default is a visible collapsed header. The old "hide" value also meant
  // collapsed, so migrate it instead of treating it as the new removed state.
  if (!hadStored) {
    if (legacy === false) set("hidden")
    else set("collapsed")
  }

  if (stored() === "show" || stored() === "hide" || stored() === "minimal") set("collapsed")

  const mode = createMemo<ThinkingMode>(() => {
    const value = stored()
    return isThinkingMode(value) ? value : "collapsed"
  })

  return {
    mode,
    set,
  }
}

export function isCommandMode(value: unknown): value is CommandMode {
  return typeof value === "string" && (COMMAND_MODES as readonly string[]).includes(value)
}

function normalizeCommandMode(value: unknown): CommandMode {
  if (isCommandMode(value)) return value
  if (value === "hide") return "hidden"
  return "collapsed"
}

export function nextCommandMode(current: CommandMode): CommandMode {
  const idx = COMMAND_MODES.indexOf(current)
  return COMMAND_MODES[(idx + 1) % COMMAND_MODES.length] ?? "collapsed"
}

export function useCommandMode() {
  const kv = useKV()
  const [stored, setStored] = kv.signal<CommandMode | "show" | "hide">("command_mode", "collapsed")

  const set = (next: CommandMode | ((prev: CommandMode) => CommandMode)) => {
    if (typeof next === "function") setStored((prev) => next(normalizeCommandMode(prev)))
    else setStored(() => next)
  }

  if (stored() === "show") set("collapsed")
  if (stored() === "hide") set("hidden")

  const mode = createMemo<CommandMode>(() => {
    const value = stored()
    return isCommandMode(value) ? value : "collapsed"
  })

  return {
    mode,
    set,
  }
}
