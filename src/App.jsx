import { useCallback, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  setDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import {
  auth,
  db,
  HOST_UID,
  PARTNER_UID,
  HOST_EMAIL,
  PARTNER_EMAIL,
  firebaseError,
} from "./firebase.js";
import {
  Activity,
  Braces,
  ChevronDown,
  ChevronRight,
  Circle,
  Code2,
  Command,
  FileCode2,
  FileJson,
  Folder,
  GitBranch,
  Heart,
  LockKeyhole,
  MoreHorizontal,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Terminal,
  Wifi,
} from "lucide-react";

/* =====================================================
   STATIC WORKSPACE FILES
===================================================== */

const directories = [
  { name: "zinger-web-d", depth: 0, folder: true },
  { name: ".config", depth: 1, folder: true },
  { name: "workspace.runtime.json", depth: 2 },
  { name: "preferences.lock", depth: 2 },
  { name: "api", depth: 1, folder: true },
  { name: "core", depth: 2, folder: true },
  { name: "events.handler.ts", depth: 3 },
  { name: "network.adapter.ts", depth: 3 },
  { name: "auth.middleware.ts", depth: 3 },
  { name: "deployment", depth: 2, folder: true },
  { name: "pipeline.yaml", depth: 3 },
  { name: "src", depth: 1, folder: true },
  { name: "components", depth: 2, folder: true },
  { name: "ConsolePanel.tsx", depth: 3 },
  { name: "SessionRenderer.tsx", depth: 3 },
  { name: "hooks", depth: 2, folder: true },
  { name: "useStream.ts", depth: 3 },
  { name: "services", depth: 2, folder: true },
  { name: "socket.client.ts", depth: 3 },
  { name: "app.config.ts", depth: 2 },
  { name: "tests", depth: 1, folder: true },
  { name: "health.spec.ts", depth: 2 },
  { name: "telemetry.spec.ts", depth: 2 },
  { name: "package.json", depth: 1 },
  { name: "vite.config.ts", depth: 1 },
];

const workspaceFiles = [
  {
    name: "SessionRenderer.tsx",
    lines: [
      "// ZINGER CORE / EVENT HANDLING MODULE",
      "import { createRuntime, resolveSession } from '@zinger/core';",
      "import { streamAdapter } from './services/runtime';",
      "",
      "export const workspace = createRuntime({",
      "  environment: 'development',",
      "  transport: 'websocket',",
      "  strategy: 'incremental',",
      "  monitor: true,",
      "  channels: ['system', 'events', 'stdout'],",
      "});",
      "",
      "async function initialize() {",
      "  const session = await resolveSession();",
      "  if (session.active) {",
      "    workspace.attach(session);",
      "    streamAdapter.listen(workspace);",
      "  }",
      "  return workspace.status;",
      "}",
      "",
      "initialize();",
    ],
  },
  {
    name: "runtime.config.json",
    lines: [
      "{",
      '  "name": "zinger-web-d",',
      '  "version": "2.4.0",',
      '  "runtime": {',
      '    "environment": "development",',
      '    "transport": "websocket",',
      '    "reconnect": true,',
      '    "maxRetries": 32,',
      '    "workerThreads": 4,',
      '    "monitoring": true',
      "  },",
      '  "modules": ["core", "runtime", "events"]',
      "}",
    ],
  },
  {
    name: "dev-runtime.log",
    lines: [
      "> zinger@2.4.0 dev",
      "> vite --host 0.0.0.0",
      "",
      "[INFO] Runtime initialized",
      "[INFO] Dependency graph resolved",
      "[INFO] File watcher activated",
      "[INFO] Development worker started",
      "[INFO] Monitoring active",
    ],
  },
];

/* =====================================================
   40 DIFFERENT SIMULATED MONITORING EVENTS
===================================================== */

const monitoringEvents = [
  "Resolving dependency graph",
  "Compiling runtime modules",
  "Updating source map",
  "Synchronizing workspace state",
  "Processing event queue",
  "Refreshing module cache",
  "Scanning dependency tree",
  "Validating runtime configuration",
  "Worker heartbeat acknowledged",
  "Incremental compilation completed",
  "Checking filesystem changes",
  "Rebuilding application bundle",
  "Initializing session renderer",
  "Verifying transport adapter",
  "Loading environment variables",
  "Updating application manifest",
  "Scanning imported dependencies",
  "Optimizing static asset registry",
  "Establishing worker communication",
  "Revalidating authentication context",
  "Checking runtime permissions",
  "Processing websocket heartbeat",
  "Refreshing service registry",
  "Validating session integrity",
  "Synchronizing active listeners",
  "Resolving pending async tasks",
  "Cleaning temporary runtime cache",
  "Inspecting network transport",
  "Processing incoming event payload",
  "Rebuilding incremental source map",
  "Updating runtime diagnostics",
  "Validating configuration schema",
  "Inspecting memory allocation table",
  "Checking module compatibility",
  "Synchronizing background workers",
  "Verifying client connection state",
  "Processing scheduled healthcheck",
  "Refreshing telemetry snapshot",
  "Updating session metadata",
  "Runtime integrity check completed",
];
const serverNodes = [
  "server-core",
  "grid-alpha",
  "runtime-node",
  "cloud-relay",
  "server-edge",
  "cluster-primary",
  "grid-delta",
  "sync-engine",
  "server-gateway",
  "compute-node",
  "cloud-instance",
  "cluster-beta",
  "network-hub",
  "runtime-host",
  "grid-omega",
  "server-proxy",
];

/* =====================================================
   35 DIFFERENT SIMULATED TERMINAL COMMANDS
===================================================== */

const terminalCommands = [
  "npm run build --silent",
  "tsc --noEmit",
  "vite:hmr check",
  "git status --short",
  "node ./scripts/healthcheck.mjs",
  "worker:sync --target local",
  "runtime:verify --session active",
  "node ./scripts/check-config.mjs",
  "vite:deps optimize",
  "worker:heartbeat --check",
  "cache:validate --all",
  "runtime:inspect --transport",
  "session:sync --incremental",
  "module:resolve --strict",
  "npm run lint --silent",
  "node ./scripts/diagnostics.mjs",
  "event:queue --inspect",
  "transport:verify --relay",
  "build:manifest --refresh",
  "source-map:validate",
  "worker:health --verbose",
  "runtime:services --status",
  "filesystem:watch --verify",
  "session:token --validate",
  "module:cache --inspect",
  "network:adapter --check",
  "runtime:telemetry --snapshot",
  "npm audit --omit=dev",
  "git diff --stat",
  "runtime:threads --inspect",
  "service:registry --refresh",
  "worker:queue --flush-check",
  "runtime:events --validate",
  "compiler:incremental --check",
  "session:integrity --verify",
];

/* =====================================================
   HELPERS
===================================================== */

function clock(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Random interval: minimum 2000ms, maximum 5000ms
function randomDelay() {
  return 2000 + Math.floor(Math.random() * 3001);
}

// Fisher-Yates shuffle
function shuffleItems(items) {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}

// Returns a shuffled item without repeating the whole sequence immediately.
function getNextShuffledItem(items, queueRef) {
  if (queueRef.current.length === 0) {
    queueRef.current = shuffleItems(items);
  }

  return queueRef.current.pop();
}

/* =====================================================
   DUDU / BUBU BEAR
===================================================== */

function Bear({ white = false, small = false }) {
  return (
    <svg
      width={small ? 48 : 118}
      height={small ? 48 : 118}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <circle
        cx="30"
        cy="31"
        r="16"
        fill={white ? "#fff" : "#b67a60"}
        stroke="#654738"
        strokeWidth="3"
      />

      <circle
        cx="90"
        cy="31"
        r="16"
        fill={white ? "#fff" : "#b67a60"}
        stroke="#654738"
        strokeWidth="3"
      />

      <rect
        x="17"
        y="23"
        width="86"
        height="84"
        rx="40"
        fill={white ? "#fffdfb" : "#c99278"}
        stroke="#654738"
        strokeWidth="3"
      />

      <circle cx="43" cy="65" r="4" fill="#48302a" />
      <circle cx="77" cy="65" r="4" fill="#48302a" />

      <ellipse
        cx="30"
        cy="76"
        rx="10"
        ry="6"
        fill="#f7a9aa"
      />

      <ellipse
        cx="90"
        cy="76"
        rx="10"
        ry="6"
        fill="#f7a9aa"
      />

      <path
        d="M53 77q7 11 14 0"
        stroke="#48302a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      <path
        d="M57 73l3 3 3-3"
        stroke="#48302a"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

/* =====================================================
   LOGIN
===================================================== */

function Login({ configurationError }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    if (configurationError) return;

    setBusy(true);
    setError("");

    try {
      const userIdentifier = username.trim().toLowerCase();

      let email = null;

      if (userIdentifier === "zinghost345") {
        email = HOST_EMAIL;
      } else if (userIdentifier === "betu") {
        email = PARTNER_EMAIL;
      }

      if (!email) {
        throw new Error("Invalid login details");
      }

      const result = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (
        ![HOST_UID, PARTNER_UID].includes(result.user.uid)
      ) {
        await signOut(auth);
        throw new Error("Account not authorized");
      }
    } catch (err) {
      setError(
        err.message?.includes("authorized")
          ? "Account not authorized"
          : "Invalid login details or Firebase not configured"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-grid" />

      <div className="login-card">
        <div className="login-logo">
          <Terminal size={24} />

          <span>
            Z<span className="green">/</span>WEB.D
          </span>
        </div>

        <span className="login-overline">
          PRIVATE WORKSPACE • SESSION AUTHENTICATION
        </span>

        <h1>
          Welcome to the workspace
          <span className="green">.</span>
        </h1>

        <p>Sign in to continue your private session.</p>

        <form onSubmit={handleLogin}>
          <label>
            USER IDENTIFIER

            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter user ID"
            />
          </label>

          <label>
            ACCESS KEY

            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter password"
            />
          </label>

          {(configurationError || error) && (
            <div className="login-error" role="alert">
              {configurationError || error}
            </div>
          )}

          <button
            disabled={busy || Boolean(configurationError)}
            className="login-btn"
          >
            <LockKeyhole size={16} />

            {busy
              ? "AUTHENTICATING..."
              : "INITIALIZE SESSION"}

            <span>↗</span>
          </button>
        </form>

        <div className="login-foot">
          <ShieldCheck size={15} />

          AUTHORIZED ACCESS ONLY

          <span>v 2.4.0</span>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   DESKTOP WORKSPACE
===================================================== */

function Desktop({ messages, send, connected, logout, unreadCount, markRead, partnerSeenAt, peerActive, peerTyping, onTypingActivity, onChatOpenChange }) {
  const [draft, setDraft] = useState("");
  const [activeTab, setActiveTab] = useState(
    "SessionRenderer.tsx"
  );
  const [bottomTab, setBottomTab] = useState("TERMINAL");

  const [logs, setLogs] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([]);

  const [liveLine, setLiveLine] = useState(
    "// Waiting for runtime event..."
  );

  const [tick, setTick] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [closedFolders, setClosedFolders] = useState({});

  const [chatVisible, setChatVisible] = useState(true);

  useEffect(() => {
    onChatOpenChange(chatVisible);
    if (!chatVisible) onTypingActivity(false);
  }, [chatVisible, onChatOpenChange, onTypingActivity]);

  const chatRef = useRef(null);
  const logRef = useRef(null);
  const terminalRef = useRef(null);

  const monitoringQueueRef = useRef([]);
  const terminalQueueRef = useRef([]);

  /* ---------------------------------------------------
     RANDOM LIVE FEED: 2–5 SECONDS
  --------------------------------------------------- */

  useEffect(() => {
    let counter = 0;
    let timeoutId;
    let cancelled = false;

    const generateActivity = () => {
      if (cancelled) return;

      counter++;

      const event = getNextShuffledItem(
        monitoringEvents,
        monitoringQueueRef
      );

      const command = getNextShuffledItem(
        terminalCommands,
        terminalQueueRef
      );

      const time = new Date().toLocaleTimeString();

      const duration =
        Math.floor(Math.random() * 95) + 7;

      const worker =
  serverNodes[Math.floor(Math.random() * serverNodes.length)];

      setTick(counter);

      setLogs((previous) => [
        ...previous.slice(-79),
        {
          id: counter,
          time,
          event,
          worker,
          duration,
        },
      ]);

      setLiveLine(
        `[watch:${String(counter).padStart(4, "0")}] ${event} // ${duration}ms`
      );

      setTerminalLogs((previous) => [
        ...previous.slice(-59),
        {
          id: counter,
          time,
          command,
        },
      ]);

      // Each event schedules the next event independently.
      // Delay changes randomly between 2 and 5 seconds.
      timeoutId = window.setTimeout(
        generateActivity,
        randomDelay()
      );
    };

    timeoutId = window.setTimeout(
      generateActivity,
      randomDelay()
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  /* ---------------------------------------------------
     UPTIME TIMER: REAL SECONDS
  --------------------------------------------------- */

  useEffect(() => {
    const startTime = Date.now();

    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - startTime) / 1000)
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

/* ---------------------------------------------------
   CHAT SHORTCUT: CTRL + M
--------------------------------------------------- */

useEffect(() => {
  const handleShortcut = (event) => {
    if (
      event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "m"
    ) {
      event.preventDefault();

      setChatVisible((previous) => !previous);
    }
  };

  window.addEventListener("keydown", handleShortcut);

  return () => {
    window.removeEventListener(
      "keydown",
      handleShortcut
    );
  };
}, []);

  /* ---------------------------------------------------
     AUTO SCROLL
  --------------------------------------------------- */

  useEffect(() => {
    if (!chatVisible) return;

    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, chatVisible]);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [logs]);

  useEffect(() => {
    terminalRef.current?.scrollTo({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [terminalLogs, bottomTab]);

  useEffect(() => {
    if (!chatVisible || document.visibilityState !== "visible") return;
    markRead();
    const onVisible = () => { if (document.visibilityState === "visible") markRead(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [chatVisible, messages, markRead]);
  const lastHostSent = [...messages].reverse().find(m => m.role === "host");
  /* ---------------------------------------------------
     CHAT SUBMISSION
  --------------------------------------------------- */

  const submit = (event) => {
    event.preventDefault();

    if (!draft.trim() || !connected) return;

    send(draft.trim());
    onTypingActivity(false);
    setDraft("");
  };

  /* ---------------------------------------------------
     FILE EXPLORER
  --------------------------------------------------- */

  const toggleFolder = (index) => {
    setClosedFolders((previous) => ({
      ...previous,
      [index]: !previous[index],
    }));
  };

  const activeFile =
    workspaceFiles.find(
      (file) => file.name === activeTab
    ) || workspaceFiles[0];

  const visibleDirectories = [];

  directories.forEach((file, index) => {
    let hidden = false;

    for (let i = index - 1; i >= 0; i--) {
      if (directories[i].depth < file.depth) {
        if (closedFolders[i]) hidden = true;

        let depth = directories[i].depth;

        for (let j = i - 1; j >= 0; j--) {
          if (directories[j].depth < depth) {
            if (closedFolders[j]) hidden = true;

            depth = directories[j].depth;
          }
        }

        break;
      }
    }

    if (!hidden) {
      visibleDirectories.push({ ...file, index });
    }
  });

  const hours = String(
    Math.floor(elapsedSeconds / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor((elapsedSeconds % 3600) / 60)
  ).padStart(2, "0");

  const seconds = String(
    elapsedSeconds % 60
  ).padStart(2, "0");

  /* ---------------------------------------------------
     DESKTOP JSX
  --------------------------------------------------- */

  return (
    <div className="ide">
      {/* HEADER */}

      <header className="ide-top">
        <div className="top-brand">
          <span className="brand-hex">
            Z<span>/</span>
          </span>

          <b>ZINGER WEB D</b>

          <span className="top-subtitle">
            Developer Workspace
          </span>
        </div>

        <nav>
          File &nbsp; Edit &nbsp; Selection &nbsp; View
          &nbsp; Go &nbsp; Run &nbsp; Terminal &nbsp;
          Help
        </nav>

        <div className="top-status">
          <Circle
            size={8}
            fill={connected ? "#4ade80" : "#f97373"}
            stroke="none"
          />

          {connected
            ? "RUNTIME CONNECTED"
            : "RECONNECTING"}

          <button onClick={logout}>EXIT</button>
        </div>
      </header>

      <div className="ide-body">
        {/* ACTIVITY BAR */}

        <aside className="activity">
          <Code2 className="active" />
          <Search />
          <GitBranch />
          <Activity />
          <Braces />

          <div className="activity-bottom">
            <Settings2 />
          </div>
        </aside>

        {/* EXPLORER */}

        <aside className="explorer">
          <div className="panel-heading">
            EXPLORER
            <MoreHorizontal size={15} />
          </div>

          <div className="explorer-section">
            <ChevronDown size={13} />
            ZINGER / WORKSPACE
            <span>●</span>
          </div>

          <div className="file-tree">
            {visibleDirectories.map((file) => (
              <div
                key={file.index}
                className="file-line"
                style={{
                  paddingLeft: 10 + file.depth * 13,
                }}
                onClick={() => {
                  if (file.folder) {
                    toggleFolder(file.index);
                    return;
                  }

                  const found = workspaceFiles.find(
                    (item) => item.name === file.name
                  );

                  if (found) {
                    setActiveTab(found.name);
                  }
                }}
              >
                {file.folder ? (
                  closedFolders[file.index] ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )
                ) : (
                  <span style={{ width: 12 }} />
                )}

                {file.folder ? (
                  <Folder size={14} color="#cbad73" />
                ) : file.name.endsWith(".json") ? (
                  <FileJson size={14} color="#c9a0ef" />
                ) : (
                  <FileCode2 size={14} color="#6fa3d3" />
                )}

                <span>{file.name}</span>
              </div>
            ))}
          </div>

          <div className="explorer-footer">
            <GitBranch size={13} />
            main
            <span>✓ synced</span>
          </div>
        </aside>

        {/* MAIN CODE AREA */}

        <main className="code-area">
          {/* FILE TABS */}

          <div className="tabline">
            {workspaceFiles.map((file) => (
              <button
                key={file.name}
                className={`tab ${
                  activeTab === file.name ? "active" : ""
                }`}
                onClick={() => setActiveTab(file.name)}
              >
                <FileCode2 size={14} />
                {file.name}
              </button>
            ))}
          </div>

          {/* BREADCRUMBS */}

          <div className="breadcrumbs">
            zinger-web-d
            <ChevronRight size={12} />
            src
            <ChevronRight size={12} />
            {activeTab}
          </div>

          {/* LIVE CODE EDITOR */}

          <div className="code-mock live-code-editor">
            <div className="code-numbers">
              {[
                ...activeFile.lines,
                "",
                liveLine,
              ].map((_, index) => (
                <span key={index}>{index + 1}</span>
              ))}
            </div>

            <div className="code-content">
              {activeFile.lines.map((line, index) => (
                <p key={`${activeTab}-${index}`}>
                  {line || "\u00A0"}
                </p>
              ))}

              <p>&nbsp;</p>

              <p className="live-code-line">
                {liveLine}
                <span className="typing-cursor" />
              </p>
            </div>
          </div>

          {/* BOTTOM CONSOLE */}

          <section className="bottom-console">
            <div className="bottom-tabs">
              {[
                "PROBLEMS",
                "OUTPUT",
                "TERMINAL",
                "DEBUG CONSOLE",
                "PORTS",
              ].map((item) => (
                <button
                  key={item}
                  className={
                    bottomTab === item ? "selected" : ""
                  }
                  onClick={() => setBottomTab(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {unreadCount > 0 && !chatVisible && <button className="terminal-unread-warning"
              onClick={() => setChatVisible(true)}>
              ● [ERROR OCCURRED] <b>{unreadCount} FUNCTIONAL ALERT{unreadCount === 1 ? "" : "S"}</b>
              <span>CTRL+M TO INSPECT</span>
            </button>}
            <div className="mini-output" ref={terminalRef}>
              {bottomTab === "TERMINAL" ? (
                <>
                  <div>
                    <span className="prompt">
                      zinger@workspace
                    </span>
                    :
                    <span className="blue">
                      ~/src
                    </span>
                    $ npm run dev
                  </div>

                  <div>vite v6.4.5 ready</div>

                  <div className="muted">
                    ➜ Local: http://localhost:5173/
                  </div>

                  <div>
                    <span className="green">✓</span>{" "}
                    Runtime initialized
                  </div>

                  {terminalLogs.map((log) => (
                    <div key={log.id}>
                      <span className="muted">
                        [{log.time}]
                      </span>{" "}
                      <span className="green">
                        ✓
                      </span>{" "}
                      {log.command}
                    </div>
                  ))}
                </>
              ) : bottomTab === "PROBLEMS" ? (
                <>
                  <div className="green">
                    ✓ No diagnostic errors
                  </div>

                  <div>
                    0 errors, 0 warnings
                  </div>

                  <div className="muted">
                    Runtime diagnostics channel ready.
                  </div>
                </>
              ) : bottomTab === "PORTS" ? (
                <>
                  <div>
                    PORT 5173 — Development preview
                  </div>

                  <div>
                    STATE — Channel initialized
                  </div>

                  <div className="green">
                    ✓ Port registry ready
                  </div>
                </>
              ) : (
                <>
                  <div>
                    [{bottomTab}] Channel initialized
                  </div>

                  <div className="green">
                    ✓ Diagnostics available
                  </div>

                  {logs.slice(-30).map((log) => (
                    <div key={log.id}>
                      <span className="muted">
                        [{log.time}]
                      </span>{" "}
                      {log.event}
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </main>

        {/* RIGHT LIVE MONITOR */}

        <aside className="right-side">
          <div className="right-panel-title">
            <Activity size={15} />

            LIVE PROCESS MONITOR

            <span className="pulse" />
          </div>

          <div className="monitor-metrics">
            <div>
              <small>CPU LOAD</small>

              <b>
                {(12 + ((tick * 7) % 28)).toFixed(1)}
                %
              </b>
            </div>

            <div>
              <small>MEMORY</small>

              <b>428 MB</b>
            </div>

            <div>
              <small>UPTIME</small>

              <b>
                {hours}:{minutes}:{seconds}
              </b>
            </div>
          </div>

          {/* ANIMATED BARS */}

          <div className="bars">
            {Array.from(
              { length: 32 },
              (_, index) => (
                <span
                  key={index}
                  style={{
                    height:
                      14 +
                      ((index * 13 + tick * 7) % 46) +
                      "px",
                  }}
                />
              )
            )}
          </div>

          <div className="trace-head">
            SYSTEM EVENT STREAM
            <span>● live feed</span>
          </div>

          {/* EVENTS */}

          <div
            className="log-stream"
            ref={logRef}
          >
            {logs.map((log) => (
              <div key={log.id}>
                <span>
                  [{log.time}]
                </span>{" "}

                <b>INFO</b>{" "}

<span className="green">
  {log.worker}
</span>

                {log.event}

                <span className="muted">
                  {" "}({log.duration}ms)
                </span>
              </div>
            ))}
          </div>

          <div className="trace-footer">
            <Wifi size={13} />

            transport: relay

            <span>
              {connected ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </aside>

        {/* CHAT WINDOW — TOGGLED BY SHORTCUT */}

        {chatVisible && (
          <section className="chat-panel">
            <div className="chat-header">
              <div>
                <Command size={15} />

                <b>STREAM INSPECTOR</b>

                <small>
                  {peerTyping ? "peer02@remote · typing..." :
                    peerActive ? "peer02@remote · ACTIVE" : "peer02@remote · AWAY"}
                </small>
              </div>

              <span
                className={`little-dot ${peerActive ? "peer-is-active" : "peer-is-away"}`}
                title={peerActive ? "Partner chat is active" : "Partner is away"}
              />
            </div>

            <div className="chat-meta">
              /var/log/runtime/relay/host/events
              <br />
              OWNER: zinghost345@local.root
            </div>

            <div
              className="chat-scroll"
              ref={chatRef}
            >
              {messages.length === 0 && (
                <div className="chat-empty">
                  // Waiting for session events...
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-entry ${
                    message.role === "partner"
                      ? "incoming"
                      : "outgoing"
                  }`}
                >
                  <span className="chat-time">
                    [{clock(message.createdAt)}]
                  </span>

                  <span className="chat-address">
                    {message.role === "partner"
                      ? "peer02@remote"
                      : "root@host"}
                  </span>

                  <span className="chat-text">
                    {message.replyTo?.text && <span className="terminal-quote">↳ {message.replyTo.text}</span>}
                    {message.text}
                    {message.id === lastHostSent?.id &&
                      <span
                        className={`desktop-seen-dot ${partnerSeenAt >= lastHostSent.createdAt ? "is-seen" : "is-sent"}`}
                        role="img"
                        aria-label={partnerSeenAt >= lastHostSent.createdAt ? "Seen" : "Sent"}
                        title={partnerSeenAt >= lastHostSent.createdAt ? "Seen" : "Sent"}
                      />}
                  </span>
                </div>
              ))}
            </div>

            <form
              className="chat-input"
              onSubmit={submit}
            >
              <span>$</span>

              <input
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  onTypingActivity(Boolean(e.target.value.trim()));
                }}
                placeholder="execute input..."
                maxLength={2000}
                aria-label="Message"
              />

              <button
                type="submit"
                disabled={
                  !connected || !draft.trim()
                }
                aria-label="Send"
              >
                <Send size={14} />
              </button>
            </form>

            <div className="chat-footer">
              <span>UTF-8</span>

              <span>24H TTL</span>

              <span className="green">
                ● SESSION ACTIVE
              </span>
            </div>
          </section>
        )}
      </div>

      {/* STATUS BAR */}

      <footer className="statusbar">
        <div>
          <GitBranch size={12} />

          main* &nbsp; ◯ 0 errors &nbsp; 0 warnings
        </div>

        <div>
          <Activity size={12} />

          DEV NODE 04

          <span>UTF-8</span>

          <span>TypeScript React</span>

          <span>Ⓩ Zinger Runtime</span>
        </div>
      </footer>
    </div>
  );
}

/* =====================================================
   PARTNER MOBILE INTERFACE
===================================================== */


function Mobile({ messages, send, connected, logout, markRead, hostSeenAt, peerActive, peerTyping, onTypingActivity }) {
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [welcome, setWelcome] = useState(() => {
    try { return localStorage.getItem("zinger-welcome-once-v2") !== "done"; }
    catch { return true; }
  });
  const inputRef = useRef(null), chatRef = useRef(null), swipeRef = useRef(null);
  const firstRef = useRef(true), bottomRef = useRef(true);
  const lastMine = [...messages].reverse().find(m => m.role === "partner");

  useEffect(() => {
    try { localStorage.setItem("zinger-welcome-once-v2", "done"); } catch {}
  }, []);
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    if (firstRef.current) {
      firstRef.current = false;
      el.scrollTop = welcome ? 0 : el.scrollHeight;
    } else if (bottomRef.current && !welcome) el.scrollTop = el.scrollHeight;
  }, [messages, welcome]);
  useEffect(() => {
    if (!welcome && bottomRef.current && document.visibilityState === "visible") markRead();
    const check = () => {
      if (!welcome && bottomRef.current && document.visibilityState === "visible") markRead();
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [messages, welcome, markRead]);
  const onScroll = () => {
    const el = chatRef.current;
    if (!el) return;
    bottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 85;
    if (welcome && el.scrollTop > 50) setWelcome(false);
    if (bottomRef.current && !welcome && document.visibilityState === "visible") markRead();
  };
  const startSwipe = (e, message) => {
    const p = e.touches[0];
    if (p) swipeRef.current = { x: p.clientX, y: p.clientY, message };
  };
  const endSwipe = (e) => {
    const p = e.changedTouches[0], initial = swipeRef.current;
    swipeRef.current = null;
    if (!p || !initial) return;
    if (p.clientX - initial.x > 55 && Math.abs(p.clientY - initial.y) < 40) {
      const {id, role, text} = initial.message;
      setReplyTo({ id, role, text: text.slice(0, 160) });
      requestAnimationFrame(() => inputRef.current?.focus({preventScroll:true}));
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!draft.trim() || !connected) return;
    const okay = await send(draft.trim(), replyTo);
    if (okay) {
      setDraft(""); setReplyTo(null); bottomRef.current = true;
      onTypingActivity(false);
      requestAnimationFrame(() => {
        if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
        inputRef.current?.focus({preventScroll:true});
      });
    }
  };
  return <div className="mobile">
    <div className="decor decor1">♥</div><div className="decor decor2">✿</div>
    <header className="mobile-head">
      <div className="mobile-bears"><Bear small/><Bear small white/></div>
      <div><h2>Dudu &amp; Bubu <Heart size={16} fill="#ec7991"/></h2>
        <p>
          <span className={`online-dot ${peerActive ? "" : "peer-is-away"}`}/>
          {peerTyping ? "Dudu is typing..." :
            peerActive ? "Dudu is active now ♡" :
            connected ? "Dudu is away · Together, even from afar" : "Connecting to you..."}
        </p></div>
      <button className="mobile-exit" onClick={logout}>♡ Exit</button>
    </header>
    <div className="mobile-chat" ref={chatRef} onScroll={onScroll}>
      {welcome && <div className="love-banner">
        <div className="heart-floating">♡ ♥ ♡</div>
        <div className="big-bears"><Bear/><Bear white/></div>
        <b>Our little happy place ♡</b><span>Every message is a tiny hug.</span>
      </div>}
      <div className="date-chip">Today • just us two ♡</div>
      {messages.map(message => <div key={message.id}
        className={"bubble-wrap " + (message.role === "partner" ? "self" : "other")}
        onTouchStart={e => startSwipe(e,message)} onTouchEnd={endSwipe}>
        <div className="bubble">
          {message.replyTo?.text && <div className="mobile-reply-quote">
            <b>↳ {message.replyTo.role === "partner" ? "Bubu" : "Dudu"}</b>
            <span>{message.replyTo.text}</span></div>}
          {message.text}
          <small>{clock(message.createdAt)}{message.role === "partner" ? " ♡" : ""}</small>

        </div>
      </div>)}
    </div>
    <form className="mobile-compose" onSubmit={submit}>
      {replyTo && <div className="mobile-reply-preview">
        <div><b>↪ Replying to {replyTo.role === "partner" ? "Bubu" : "Dudu"}</b>
          <span>{replyTo.text}</span></div>
        <button type="button" onClick={() => setReplyTo(null)}>×</button>
      </div>}
      <span>♡</span>
      <input ref={inputRef} value={draft} onChange={e => {
        setDraft(e.target.value);
        onTypingActivity(Boolean(e.target.value.trim()));
      }}
        maxLength={2000} placeholder="Write something sweet..." aria-label="Message"
        autoComplete="off"/>
      <button type="submit" onPointerDown={e => e.preventDefault()}
        disabled={!connected || !draft.trim()} aria-label="Send message"><Send size={19}/></button>
    </form>
    <div className="mobile-bottom">Made with love, for us two ♡</div>
  </div>;
}

/* =====================================================
   MAIN APP — FIREBASE
===================================================== */



// Browser-tab unread count and an optional red count badge on the Z favicon.
// Canvas output is a data URL, so it works on GitHub Pages as well as localhost.
function useTabUnreadBadge(unreadCount, active) {
  useEffect(() => {
    const icon = document.querySelector('link[rel="icon"]') ||
      document.createElement("link");
    if (!icon.parentNode) {
      icon.rel = "icon";
      icon.type = "image/png";
      document.head.appendChild(icon);
    }
    const normalTitle = "ZINGER WEB D — Workspace";
    const count = active ? unreadCount : 0;
    document.title = count > 0 ? `(${count}) ${normalTitle}` : normalTitle;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#132a20";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = "#70e6a1";
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 60, 60);
    ctx.fillStyle = "#a3ffca";
    ctx.font = "bold 38px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Z", 29, 35);

    if (count > 0) {
      const badge = count > 99 ? "99+" : String(count);
      ctx.fillStyle = "#f43f5e";
      ctx.beginPath();
      ctx.arc(49, 15, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = badge.length >= 3 ? "bold 13px Arial" : "bold 17px Arial";
      ctx.fillText(badge, 49, 16);
    }
    icon.type = "image/png";
    icon.href = canvas.toDataURL("image/png");
  }, [unreadCount, active]);
}

export default function App() {
  const [session,setSession] = useState(null), [loading,setLoading] = useState(true);
  const [messages,setMessages] = useState([]), [connected,setConnected] = useState(false);
  const [error,setError] = useState("");
  const [readAt,setReadAt] = useState({host:0,partner:0});
  const [remotePresence,setRemotePresence] = useState(null);
  const [typing,setTyping] = useState(false);
  const [hostChatOpen,setHostChatOpen] = useState(true);
  const [pageVisible,setPageVisible] = useState(() => document.visibilityState === "visible");
  const [now,setNow] = useState(Date.now());
  const pending = useRef(0);
  const typingTimeoutRef = useRef(null);

  const onChatOpenChange = useCallback(open => setHostChatOpen(open), []);
  const onTypingActivity = useCallback(hasText => {
    window.clearTimeout(typingTimeoutRef.current);
    setTyping(Boolean(hasText));
    if (hasText) typingTimeoutRef.current = window.setTimeout(() => setTyping(false), 1700);
  }, []);

  useEffect(() => {
    const check = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
      window.clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const localActive = Boolean(session && pageVisible &&
    (session.role === "partner" || hostChatOpen));

  useEffect(() => {
    if (!session || !db) return;
    const otherUid = session.role === "host" ? PARTNER_UID : HOST_UID;
    if (!otherUid) return;
    return onSnapshot(doc(db, "presence", otherUid), snap => {
      const data = snap.data();
      setRemotePresence(data ? {
        active: data.active === true,
        typing: data.typing === true,
        updatedAt: data.updatedAt?.toMillis?.() || 0
      } : null);
    }, err => setError("Presence status: " + err.message));
  }, [session]);

  useEffect(() => {
    if (!session || !db) return;
    const publish = () => {
      setDoc(doc(db, "presence", session.uid), {
        uid: session.uid,
        active: localActive,
        typing: localActive && typing,
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(err => setError("Presence update: " + err.message));
    };
    publish();
    const timer = window.setInterval(publish, 12000);
    return () => window.clearInterval(timer);
  }, [session, localActive, typing]);

  const peerActive = Boolean(remotePresence?.active &&
    now - remotePresence.updatedAt < 35000);
  const peerTyping = Boolean(peerActive && remotePresence?.typing);
  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, async user => {
      const role = user?.uid === HOST_UID ? "host" : user?.uid === PARTNER_UID ? "partner" : null;
      if (user && !role) { await signOut(auth); setSession(null); }
      else setSession(role ? {role,uid:user.uid} : null);
      setLoading(false);
    });
  },[]);
  useEffect(() => {
    if (!session || !db) { setMessages([]); setConnected(false); return; }
    const q=query(collection(db,"messages"),orderBy("createdAt","desc"),limit(200));
    return onSnapshot(q,snap=>{
      setMessages(snap.docs.map(d=>({id:d.id,...d.data(),
        createdAt:d.data().createdAt?.toMillis?.()||Date.now()}))
        .filter(m=>m.createdAt+86400000>Date.now()).reverse());
      setConnected(true); setError("");
    },err=>{setConnected(false);setError("Connection error: "+err.message);});
  },[session]);
  useEffect(() => {
    if (!session || !db || !HOST_UID || !PARTNER_UID) return;
    const unsubHost=onSnapshot(doc(db,"readStatus",HOST_UID),s=>
      setReadAt(p=>({...p,host:s.data()?.lastSeenAt?.toMillis?.()||0})),
      e=>setError("Read status: "+e.message));
    const unsubPartner=onSnapshot(doc(db,"readStatus",PARTNER_UID),s=>
      setReadAt(p=>({...p,partner:s.data()?.lastSeenAt?.toMillis?.()||0})),
      e=>setError("Read status: "+e.message));
    return ()=>{unsubHost();unsubPartner();};
  },[session]);
  useEffect(()=>{
    const id=setInterval(()=>setMessages(current=>
      current.filter(m=>m.createdAt+86400000>Date.now())),60000);
    return ()=>clearInterval(id);
  },[]);
  const unreadCount=session ? messages.filter(m=>
    m.role!==session.role && m.createdAt>readAt[session.role]).length : 0;
  useTabUnreadBadge(unreadCount, session?.role === "host");

  const markRead=useCallback(async ()=>{
    if (!session || !db || document.visibilityState!=="visible") return;
    const latest=[...messages].reverse().find(m=>m.role!==session.role);
    if (!latest || latest.createdAt<=readAt[session.role] || latest.createdAt<=pending.current) return;
    pending.current=latest.createdAt;
    try {await setDoc(doc(db,"readStatus",session.uid),
      {uid:session.uid,lastSeenAt:serverTimestamp()},{merge:true});}
    catch(e){pending.current=0;setError("Read receipt: "+e.message);}
  },[session,messages,readAt]);
  useEffect(()=>{pending.current=0;},[session?.uid]);
  const logout=async ()=>{
    window.clearTimeout(typingTimeoutRef.current);
    setTyping(false);
    if (session && db) {
      try {
        await setDoc(doc(db,"presence",session.uid),{
          uid:session.uid,active:false,typing:false,updatedAt:serverTimestamp()
        },{merge:true});
      } catch { /* A stale presence automatically expires. */ }
    }
    await signOut(auth);
  };
  const send=async (text,replyTo=null)=>{
    if(!session||!db||!text.trim())return false;
    try{
      const payload={text:text.trim().slice(0,2000),role:session.role,
        authorUid:session.uid,createdAt:serverTimestamp()};
      if(replyTo?.id && replyTo?.text)payload.replyTo={
        id:replyTo.id,role:replyTo.role,text:replyTo.text.slice(0,160)};
      await addDoc(collection(db,"messages"),payload);return true;
    }catch(e){setError("Could not send: "+e.message);return false;}
  };
  if(loading)return <div className="loading-screen">ZINGER WEB D • Initializing session...</div>;
  if(!session)return <Login configurationError={firebaseError}/>;
  return <>
    {error&&<div className="connection-warning">{error}</div>}
    {session.role==="host"
      ?<Desktop messages={messages} send={send} connected={connected} logout={logout}
        unreadCount={unreadCount} markRead={markRead} partnerSeenAt={readAt.partner}
        peerActive={peerActive} peerTyping={peerTyping}
        onTypingActivity={onTypingActivity} onChatOpenChange={onChatOpenChange}/>
      :<Mobile messages={messages} send={send} connected={connected} logout={logout}
        markRead={markRead} hostSeenAt={readAt.host}
        peerActive={peerActive} peerTyping={peerTyping}
        onTypingActivity={onTypingActivity}/>}
  </>;
}
