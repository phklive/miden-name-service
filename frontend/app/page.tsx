"use client";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Types
type WebVersion = "web2" | "web25" | "web3";
type Mode = "register" | "lookup";

interface RegisteredUser {
  name: string;
  address: string;
  version: string;
}

interface ColorScheme {
  gradient: string;
  subtle: string;
  accent: string;
  button: string;
  border: string;
  hoverBg: string;
}

// Implementation descriptions
const IMPLEMENTATION_DESCRIPTIONS = {
  web2: "Traditional centralized database lookup. Names and addresses stored on a server with no cryptographic verification.",
  web25: "Hybrid approach with cryptographic proofs. Server generates ZK proofs for verification without full decentralization.",
  web3: "Fully decentralized on Miden blockchain. Trustless name resolution using ZK proofs and on-chain verification.",
};

// Toast Portal (Reusable for both error & success)
const Toast = ({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -15 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -15 }}
    className={`fixed top-6 right-6 z-[120] px-6 py-4 rounded-lg shadow-lg text-white ${type === "success"
      ? "bg-teal-700 border border-teal-400"
      : "bg-red-800 border border-red-400"
      } flex items-center gap-2`}
    role="alert"
    aria-live="assertive"
  >
    <span>
      {type === "success" ? (
        <svg className="inline mr-1" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="inline mr-1" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      )}
    </span>
    <span>{message}</span>
    <button
      aria-label="Close notification"
      className="ml-4 py-1 px-2 rounded bg-white/10 hover:bg-white/30 transition"
      onClick={onClose}
    >
      ×
    </button>
  </motion.div>
);

// ------ UI COMPONENTS ------

const VersionSelector = ({
  webVersion,
  setWebVersion,
}: {
  webVersion: WebVersion;
  setWebVersion: (v: WebVersion) => void;
}) => (
  <div>
    <label className="text-sm text-indigo-300 mb-2 block">Implementation</label>
    <div className="grid grid-cols-3 gap-1 bg-black/40 p-1.5 rounded-xl" role="group" aria-label="Implementation">
      {(["web2", "web25", "web3"] as const).map((version) => (
        <button
          key={version}
          type="button"
          aria-pressed={webVersion === version}
          onClick={() => setWebVersion(version)}
          className={
            `px-3 py-2 rounded-lg font-medium text-xs duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${webVersion === version
              ? `ring-1 ring-white/30 bg-gradient-to-r ${getColorSchemeForVersion(version).gradient} text-white shadow`
              : "text-indigo-300 hover:text-white hover:bg-white/10"}`
          }
        >{getVersionDisplay(version)}
        </button>
      ))}
    </div>
  </div>
);

const ModeSelector = ({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) => (
  <div>
    <label className="text-sm text-indigo-300 mb-2 block">Choose Mode</label>
    <div className="grid grid-cols-2 gap-3 bg-black/40 p-1.5 rounded-xl" role="group" aria-label="Mode">
      {(["register", "lookup"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2${mode === m
            ? " bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow"
            : " text-indigo-300 hover:text-white hover:bg-white/10"
            }`}
        >{m === "register" ? "Register Name" : "Lookup Name"}</button>
      ))}
    </div>
  </div>
);

const InputField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  disabled?: boolean;
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-indigo-200 mb-1">
      {label}
    </label>
    <input
      id={id}
      type="text"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      value={value}
      onChange={onChange}
      className="w-full px-5 py-3 bg-white/10 border border-white/10 rounded-xl focus:ring-2 focus:border-transparent text-white transition outline-none focus:ring-indigo-500/60 font-mono"
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
    />
  </div>
);

const ActionButton = ({
  type = "submit",
  disabled = false,
  colorScheme,
  children,
}: {
  type?: "button" | "submit";
  disabled?: boolean;
  colorScheme: ColorScheme;
  children: React.ReactNode;
}) => (
  <button
    type={type}
    disabled={disabled}
    className={`w-full px-6 py-3 bg-gradient-to-r ${colorScheme.button} rounded-xl font-semibold text-white shadow-lg hover:shadow-indigo-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 focus:ring-offset-black ${disabled ? "opacity-50 pointer-events-none" : "hover:-translate-y-0.5"
      } duration-200`}
  >
    {children}
  </button>
);

const RegisteredUsersTable = ({
  users,
  isLoading,
}: {
  users: RegisteredUser[];
  isLoading: boolean;
}) => {
  if (isLoading)
    return (
      <div className="flex items-center justify-center py-5">
        <svg className="animate-spin h-5 w-5 text-indigo-400 mr-2" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-indigo-300">Loading names...</span>
      </div>
    );
  if (users.length === 0)
    return (
      <div className="text-center py-5 border border-dashed border-white/10 rounded-xl text-indigo-400">
        No names registered (yet).
      </div>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-black/20 rounded-lg">
          <tr>
            <th className="px-4 py-3 text-xs font-medium text-indigo-300 uppercase tracking-wider">Name</th>
            <th className="px-4 py-3 text-xs font-medium text-indigo-300 uppercase tracking-wider">Address</th>
            <th className="px-4 py-3 text-xs font-medium text-indigo-300 uppercase tracking-wider">Version</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {users.map((user, i) => (
            <motion.tr
              key={`${user.name}-${i}`}
              className="hover:bg-white/5 transition-colors"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <td className="px-4 py-3 text-sm font-mono text-white">{user.name}</td>
              <td className="px-4 py-3 text-sm font-mono text-white truncate max-w-[180px]">{user.address}</td>
              <td className="px-4 py-3"><VersionBadge version={user.version} /></td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const VersionBadge = ({ version }: { version: string }) => {
  const badge = {
    "2": "bg-blue-900/40 text-blue-300 border-blue-400/40",
    "2.5": "bg-purple-900/40 text-purple-300 border-purple-400/40",
    "3": "bg-cyan-900/40 text-cyan-300 border-cyan-400/40",
  }[version] || "bg-gray-900/40 text-gray-300 border-gray-400/30";
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium border ${badge}`}>
      {getVersionDisplayText(version)}
    </span>
  );
};

// ------ UTILITIES ------

function getVersionDisplayText(version: string): string {
  switch (version) {
    case "2": return "Web 2.0";
    case "2.5": return "Web 2.5";
    case "3": return "Web 3.0";
    default: return `Web ${version}`;
  }
}
function getVersionDisplay(version: WebVersion): string {
  switch (version) {
    case "web2": return "Web 2.0";
    case "web25": return "Web 2.5";
    case "web3": return "Web 3.0";
  }
}
function getVersionParam(version: WebVersion): string {
  switch (version) {
    case "web2": return "2";
    case "web25": return "2.5";
    case "web3": return "3";
    default: return "2";
  }
}
function getColorSchemeForVersion(version: WebVersion): ColorScheme {
  switch (version) {
    case "web2":
      return {
        gradient: "from-blue-600 to-blue-500",
        subtle: "from-blue-900/30 to-blue-800/40",
        accent: "text-blue-200",
        button: "from-blue-600 to-blue-700",
        border: "border-blue-500/30",
        hoverBg: "hover:bg-blue-600/10",
      };
    case "web25":
      return {
        gradient: "from-purple-600 to-indigo-700",
        subtle: "from-purple-900/40 to-indigo-800/40",
        accent: "text-purple-200",
        button: "from-purple-600 to-indigo-700",
        border: "border-purple-500/30",
        hoverBg: "hover:bg-purple-600/10",
      };
    case "web3":
      return {
        gradient: "from-cyan-500 to-teal-500",
        subtle: "from-cyan-900/30 to-teal-800/40",
        accent: "text-cyan-200",
        button: "from-cyan-600 to-teal-700",
        border: "border-cyan-500/30",
        hoverBg: "hover:bg-cyan-600/10",
      };
  }
}
const validateMidenName = (name: string): boolean =>
  name.trim().toLowerCase().endsWith(".miden");

// ------ MAIN PAGE ------

export default function Home() {
  // State
  const [mode, setMode] = useState<Mode>("register");
  const [webVersion, setWebVersion] = useState<WebVersion>("web2");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  // Toast
  const [toast, setToast] = useState<null | { message: string; type: "success" | "error" }>(null);

  const colorScheme = useMemo(() => getColorSchemeForVersion(webVersion), [webVersion]);

  // Fetch registered users
  const fetchRegisteredUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch("http://localhost:3001/list");
      if (!response.ok) throw new Error("Failed to fetch users");
      setRegisteredUsers(await response.json());
    } catch (e) {
      // Silent fail, or show notification if you want
    } finally {
      setIsLoadingUsers(false);
    }
  };
  useEffect(() => {
    fetchRegisteredUsers();
  }, []);
  // Handlers
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setLookupResult("");
  };
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };
  // Submit (register)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMidenName(name)) return setToast({ type: "error", message: "Name must end with .miden" });
    if (!address) return setToast({ type: "error", message: "Address is required" });

    setIsSubmitting(true);
    try {
      const versionParam = getVersionParam(webVersion);
      const response = await fetch(
        `http://localhost:3001/register?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}&version=${versionParam}`,
        { method: "PUT" }
      );
      if (!response.ok) throw new Error(await response.text());
      setToast({ type: "success", message: `Registered ${name} (${getVersionDisplay(webVersion)})!` });
      setName("");
      setAddress("");
      fetchRegisteredUsers();
    } catch (err) {
      setToast({ type: "error", message: `Error: ${String((err as Error).message)}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit (lookup)
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMidenName(name)) return setToast({ type: "error", message: "Name must end with .miden" });
    setIsSubmitting(true);
    setLookupResult("");
    try {
      const versionParam = getVersionParam(webVersion);
      const response = await fetch(
        `http://localhost:3001/lookup?name=${encodeURIComponent(name)}&version=${versionParam}`
      );
      if (!response.ok) {
        setLookupResult(response.status === 404 ? "Name not found" : "Lookup failed");
      } else {
        setLookupResult(await response.text());
      }
    } catch (err) {
      setToast({ type: "error", message: `Error: ${String((err as Error).message)}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex flex-col items-center justify-between p-5 md:p-8 relative overflow-hidden">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-[-8%] left-[32%] w-[480px] h-[480px] bg-blue-600/10 rounded-full filter blur-3xl opacity-30"
          animate={{
            y: [0, 20, 0],
            scale: [1, 1.05, 1]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        <motion.div
          className="absolute bottom-[5%] right-[15%] w-[380px] h-[380px] bg-purple-600/20 rounded-full filter blur-3xl opacity-40"
          animate={{
            y: [0, -20, 0],
            scale: [1, 1.04, 1]
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse",
            delay: 1
          }}
        />
      </div>
      {/* Main Card */}
      <div className="w-full max-w-3xl z-10">
        <motion.h1
          className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-cyan-200 text-center mb-8 drop-shadow"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Miden Name Service
        </motion.h1>
        <motion.div
          className="bg-black/50 shadow-2xl rounded-3xl border border-white/10 p-6 md:p-8 backdrop-blur-md"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.18 }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <ModeSelector mode={mode} setMode={setMode} />
            <VersionSelector webVersion={webVersion} setWebVersion={setWebVersion} />
          </div>
          <motion.div
            className={`rounded-xl bg-gradient-to-r overflow-hidden mb-8 border ${colorScheme.border}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={`p-5 ${colorScheme.subtle}`}>
              <h3 className={`text-lg font-semibold mb-1 ${colorScheme.accent}`}>{getVersionDisplay(webVersion)} Implementation</h3>
              <p className="text-white/80 text-sm leading-relaxed select-none">
                {IMPLEMENTATION_DESCRIPTIONS[webVersion]}
              </p>
            </div>
          </motion.div>

          {/* Form section */}
          <div className="mb-8 relative">
            <h2 className="text-xl font-bold text-white mb-6">
              {mode === "register" ? "Register Name" : "Lookup Name"}
            </h2>
            {/* Action Loading Overlay */}
            <AnimatePresence>
              {isSubmitting && (
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-20"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <svg className="animate-spin w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
            {mode === "register" ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <InputField id="name" label="Name" value={name} onChange={handleNameChange} placeholder="must end with .miden" disabled={isSubmitting} />
                <InputField id="address" label="Address" value={address} onChange={handleAddressChange} placeholder="address to associate" disabled={isSubmitting} />
                <ActionButton disabled={isSubmitting} colorScheme={colorScheme}>
                  Register Name
                </ActionButton>
              </form>
            ) : (
              <form onSubmit={handleLookup} className="space-y-4">
                <InputField
                  id="lookup-name"
                  label="Name"
                  value={name}
                  onChange={handleNameChange}
                  placeholder="name to lookup"
                  disabled={isSubmitting}
                />
                {/* Lookup result */}
                <AnimatePresence>
                  {lookupResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 mt-2 bg-indigo-900/40 border border-indigo-500/40 rounded-xl"
                    >
                      <div className="text-indigo-200 text-xs font-medium mb-1">Result:</div>
                      <div className="font-mono text-sm text-white break-all whitespace-pre-line select-all">{lookupResult}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <ActionButton disabled={isSubmitting} colorScheme={colorScheme}>
                  Lookup Name
                </ActionButton>
              </form>
            )}
          </div>
          {/* List of registered users - only show in register mode */}
          {mode === "register" && (
            <motion.div
              className="border-t border-white/10 pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h3 className="text-lg font-bold text-white mb-4">Registered Names</h3>
              <RegisteredUsersTable users={registeredUsers} isLoading={isLoadingUsers} />
              {!isLoadingUsers && registeredUsers.length > 0 && (
                <div className="mt-3 text-xs text-white/50 italic text-center">
                  <p>
                    Showing {registeredUsers.length} registered {registeredUsers.length === 1 ? "name" : "names"}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </div>
      {/* Footer */}
      <motion.div
        className="text-center w-full text-indigo-300 text-sm relative z-10 mt-14"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <a
          href="https://github.com/0xMiden"
          className="text-cyan-300 hover:text-cyan-200 transition-colors underline  underline-offset-2 decoration-dotted flex items-center justify-center gap-2"
          target="_blank" rel="noopener noreferrer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          Powered by Miden Blockchain Technology
        </a>
      </motion.div>
      {/* Glow keyframes for Toast */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px);}
          to {opacity: 1; transform: translateY(0);}
        }
        @keyframes fadeOut {
          from {opacity: 1; transform: translateY(0);}
          to {opacity: 0; transform: translateY(-10px);}
        }
      `}</style>
    </div>
  );
}
