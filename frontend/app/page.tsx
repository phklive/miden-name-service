"use client";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from 'next/image';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Define API base URL with fallback to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Define types
type WebVersion = "2" | "2.5" | "3";

interface Version {
  key: WebVersion;
  name: string;
  color: string;
  desc: string;
  imageSrc: string; // Add image source property
}

// Response types matching the server format
interface LookupResponse {
  address: string;
  version: string;
}

interface RegisterResponse {
  name: string;
  address: string;
  version: string;
  transaction_id?: string;
}

// Extended response type to handle both lookup and registration
interface ResponseWithTx extends LookupResponse {
  transaction_id?: string;
  justRegistered?: boolean;  // Flag to indicate a fresh registration
}

// Version configurations - Added imageSrc
const VERSIONS: Version[] = [
  {
    key: "2",
    name: "Web 2.0",
    color: "from-blue-600 to-blue-400",
    desc: "Traditional: Centralized database lookup. Names and addresses stored on a off-chain server.",
    imageSrc: "/web2flow.png", // Path relative to public/
  },
  {
    key: "2.5",
    name: "Web 2.5",
    color: "from-purple-600 to-indigo-500",
    desc: "Hybrid: Off-chain Miden VM execution, ZK proving and transaction generation done by the server. Names and addresses stored on-chain on permisssioned public smart-contract.",
    imageSrc: "/web25flow.png", // Path relative to public/
  },
  {
    key: "3",
    name: "Web 3.0",
    color: "from-cyan-500 to-teal-400",
    desc: "Trustless: Off-chain Miden VM execution, ZK proving and transaction generation done client-side. Names and addresses stored on-chain on permissionless public smart-contract. (Not yet available)",
    imageSrc: "/web3flow.png", // Path relative to public/
  },
];

// Helper functions (keep existing ones)
const getColorSchemeForVersion = (version: string) => {
  const versionKey = VERSIONS.find(v => v.key === version) ? version as WebVersion : "2";
  return {
    primary: versionKey === "2" ? "from-blue-600 to-blue-400" : versionKey === "2.5" ? "from-purple-600 to-indigo-500" : "from-cyan-500 to-teal-400",
    background: versionKey === "2" ? "bg-blue-900/50 border-blue-400/30" : versionKey === "2.5" ? "bg-purple-900/50 border-purple-400/30" : "bg-teal-900/50 border-teal-400/30",
    button: versionKey === "2" ? "from-blue-500 to-blue-400 hover:from-blue-400 hover:to-blue-300" : versionKey === "2.5" ? "from-purple-500 to-indigo-400 hover:from-purple-400 hover:to-indigo-300" : "from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300",
    text: versionKey === "2" ? "text-blue-300" : versionKey === "2.5" ? "text-purple-300" : "text-teal-300",
    badge: versionKey === "2" ? "bg-blue-900 text-blue-200" : versionKey === "2.5" ? "bg-purple-900 text-purple-200" : "bg-teal-900 text-teal-200"
  };
};
const getVersionParam = (version: WebVersion): string => version;
const validateMidenName = (name: string): boolean => name.toLowerCase().endsWith('.miden');
const validateAddress = (address: string): boolean => /^0x[0-9a-fA-F]{1,48}$/.test(address) && address.length <= 50;
const getVersionName = (versionKey: string): string => VERSIONS.find(v => v.key === versionKey)?.name || `Web ${versionKey}`;


// Main component
export default function Home() {
  const [selected, setSelected] = useState<WebVersion>("2");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lookupResult, setLookupResult] = useState<ResponseWithTx | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [indexingTransaction, setIndexingTransaction] = useState(false);

  // State for Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Memoized color scheme
  const colorScheme = useMemo(
    () => getColorSchemeForVersion(selected),
    [selected]
  );

  // Dynamic color scheme for lookup result based on its version
  const resultColorScheme = useMemo(
    () => lookupResult ? getColorSchemeForVersion(lookupResult.version) : colorScheme,
    [lookupResult, colorScheme]
  );

  // Handle version change - reset form state
  const handleVersionChange = (newVersion: WebVersion) => {
    setSelected(newVersion);
    setName("");
    setAddress("");
    setLookupResult(null);
    setError("");
    setHasSearched(false);
    setShowAddressInput(false);
    if (indexingTransaction) setIndexingTransaction(false);
  };

  const current = VERSIONS.find((v) => v.key === selected);
  const displayName = name ? name.toLowerCase().endsWith('.miden') ? name : `${name}.miden` : "";

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setError('');
    setHasSearched(false);
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    setError('');
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateMidenName(displayName)) {
      setError('Name must end with .miden');
      return;
    }
    setLoading(true); setError(''); setLookupResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/lookup?name=${encodeURIComponent(displayName)}`);
      if (!response.ok) {
        if (response.status === 404) { setLookupResult(null); setHasSearched(true); }
        else { throw new Error(`Lookup failed: ${await response.text()}`); }
      } else {
        const data: LookupResponse = await response.json();
        setLookupResult({ ...data, justRegistered: false }); setHasSearched(true);
      }
    } catch (err) { setError(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!validateMidenName(displayName)) { setError('Name must end with .miden'); return; }
    if (lookupResult) { setError('This name is already registered.'); return; }
    if (!address) { setError('Please enter an address for registration.'); return; }
    if (!validateAddress(address)) { setError('Invalid address format. Must be 0x-prefixed hex, max 24 bytes.'); return; }

    setLoading(true); setError('');
    try {
      const versionParam = getVersionParam(selected);
      const response = await fetch(`${API_BASE_URL}/register?name=${encodeURIComponent(displayName)}&address=${encodeURIComponent(address)}&version=${versionParam}`, { method: 'PUT' });
      if (!response.ok) { throw new Error(`Registration failed: ${await response.text()}`); }

      const registrationResult: RegisterResponse = await response.json();
      // Show success toast (keep existing logic)
      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-green-800 text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-fadeIn';
      successToast.textContent = `Successfully registered ${displayName} using ${current?.name || ''} implementation`;
      document.body.appendChild(successToast);
      setTimeout(() => { successToast.classList.add('animate-fadeOut'); setTimeout(() => document.body.removeChild(successToast), 500); }, 3000);


      if (selected === "2.5" && registrationResult.transaction_id) {
        setIndexingTransaction(true);
        setShowAddressInput(false); setAddress('');
        setLookupResult({ address: registrationResult.address, version: registrationResult.version, justRegistered: true });
        setTimeout(() => {
          setIndexingTransaction(false);
          setLookupResult(prev => prev ? { ...prev, transaction_id: registrationResult.transaction_id } : null);
        }, 5000);
      } else {
        setShowAddressInput(false); setAddress('');
        setLookupResult({ address: registrationResult.address, version: registrationResult.version, justRegistered: true });
      }
      setHasSearched(true);
    } catch (err) { setError(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setLoading(false); }
  };

  const copyAddress = () => {
    if (lookupResult) {
      navigator.clipboard.writeText(lookupResult.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Function to open the lightbox
  const openDiagram = () => {
    if (current?.imageSrc) {
      setLightboxOpen(true);
    }
  };

  return (
    <> {/* Use Fragment to allow Lightbox component outside the main div */}
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-black flex flex-col items-center px-4 py-10 overflow-auto">
        <div className="w-full max-w-xl flex flex-col items-center">
          {/* Header Content */}
          <h1 className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-200 via-purple-200 to-cyan-100 text-center mb-2">
            Miden Name Service
          </h1>
          <p className="text-indigo-300 text-center max-w-2xl mb-8 px-4">
            <span className="font-bold text-white">Say goodbye to cryptic addresses.</span> Register <span className="font-bold text-cyan-300">human-readable names</span> on Miden blockchain for a <span className="font-bold text-purple-300">simpler</span> crypto experience.
          </p>
          <a
            href="https://github.com/phklive/miden-name-service"
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex items-center bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md shadow-sm transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.38 0-.19-.015-1.23-.015-1.235-3.015.55-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            View on GitHub
          </a>

          {/* Version selector */}
          <div className="bg-indigo-950/40 backdrop-blur-md p-3 rounded-xl border border-indigo-800/30 flex mb-8 shadow-lg w-full justify-between">
            {VERSIONS.map((version) => (
              <div key={version.key} className="flex-1 mx-1 relative">
                <button
                  onClick={() => handleVersionChange(version.key)}
                  className={`w-full px-4 py-2.5 rounded-lg transition-all ${selected === version.key
                    ? `bg-gradient-to-r ${version.color} text-white shadow-md`
                    : "text-indigo-300 hover:bg-indigo-800/30"
                    }`}
                  type="button"
                >
                  {version.name}
                </button>
              </div>
            ))}
          </div>

          {/* Current version description and Image - Web 2.0 / 2.5 */}
          {selected !== "3" ? (
            <div className="mb-8 text-center w-full px-4">
              {current && (
                <motion.div
                  key={selected} // Animate when selected version changes
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="text-indigo-200 flex flex-col items-center" // Center content
                >
                  <p className="mb-4">{current.desc}</p>
                  {current.imageSrc && (
                    <div
                      className="mt-4 p-2 bg-white/10 border border-white/20 rounded-lg shadow-lg max-w-lg w-full cursor-pointer hover:border-white/40 transition-colors"
                      onClick={openDiagram} // Add click handler
                    >
                      <Image
                        src={current.imageSrc}
                        alt={`${current.name} Flow Diagram - Click to enlarge`} // Update alt text
                        width={600} // Adjust width as needed
                        height={400} // Adjust height as needed
                        className="w-full h-auto rounded-sm"
                        priority
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          ) : null} {/* End of Web 2/2.5 description/image block */}

          {/* Web 3.0 Coming Soon Message and Image */}
          {selected === "3" ? (
            <motion.div
              key="web3-info" // Unique key for animation
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className={`rounded-xl ${colorScheme.background} px-6 py-8 text-indigo-100 shadow-xl border-2 border-teal-500/30 w-full mb-8`}
            >
              <div className="flex flex-col items-center text-center">
                <h2 className="text-2xl font-bold text-white mb-3">Web 3.0 Coming Soon!</h2>
                <p className="text-teal-200 mb-4">{current?.desc}</p>

                {/* Display the Web 3.0 Image */}
                {current?.imageSrc && (
                  <div
                    className="mt-4 mb-6 p-2 bg-white/10 border border-white/20 rounded-lg shadow-lg max-w-lg w-full cursor-pointer hover:border-white/40 transition-colors"
                    onClick={openDiagram} // Add click handler
                  >
                    <Image
                      src={current.imageSrc}
                      alt={`${current.name} Flow Diagram - Click to enlarge`} // Update alt text
                      width={600} // Adjust as needed
                      height={400} // Adjust as needed
                      className="w-full h-auto rounded-sm"
                      priority
                    />
                  </div>
                )}

                {/* Rest of Web 3.0 Content */}
                <p className="text-indigo-200 text-sm mb-2">When launched, this feature will provide:</p>
                <ul className="text-indigo-300 text-sm space-y-1 mb-6 text-left max-w-md mx-auto">
                  <li>• Full on-chain name resolution using Miden Layer 1 blockchain</li>
                  <li>• End-to-end trustless validation using zero-knowledge proofs</li>
                  <li>• Complete decentralization with no central authority</li>
                  <li>• Enhanced privacy and security guarantees</li>
                </ul>
                <a
                  href="https://x.com/0xPolygonMiden"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-white font-semibold shadow-lg transition"
                >
                  Follow Miden for Updates
                </a>
              </div>
            </motion.div>
          ) : (
            <> {/* Wrapper for Web 2.0/2.5 form and results */}
              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="w-full mb-4 px-4 py-3 bg-red-900/60 border-2 border-red-500/50 rounded-lg text-red-100 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Name input form */}
              <form
                onSubmit={handleLookup}
                className="w-full mb-6"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Search for a name..."
                    className="w-full px-5 py-4 bg-indigo-950/60 backdrop-blur-md border-2 border-indigo-700/50 rounded-2xl text-white shadow-xl focus:outline-none focus:border-indigo-500 transition-colors text-lg"
                    disabled={loading}
                  />
                  <div className="absolute right-5 top-1/2 transform -translate-y-1/2 text-indigo-400 text-sm">
                    {!name.toLowerCase().endsWith('.miden') && '.miden'}
                  </div>
                </div>

                <button
                  type="submit"
                  className={`mt-4 w-full bg-gradient-to-r ${colorScheme.primary} hover:brightness-110 text-white py-4 px-6 rounded-xl font-semibold shadow transition-all focus:outline-none focus:ring-2 focus:ring-white/30 text-lg ${loading ? "opacity-70 cursor-wait" : !name ? "opacity-70 cursor-not-allowed" : ""}`}
                  disabled={!name || loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Searching...
                    </span>
                  ) : "Search"}
                </button>
              </form>

              {/* Result - Only show after search */}
              <AnimatePresence>
                {!loading && hasSearched && displayName && (
                  <motion.div
                    className="mb-4 w-full"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                  >
                    {lookupResult ? (
                      // Registered Name Block
                      <div className={`rounded-xl ${resultColorScheme.background} px-6 py-6 text-indigo-100 shadow-xl border-2 border-indigo-500/30`}>
                        {/* ... existing registered result content ... */}
                        <div className="flex items-center mb-4">
                          <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-xl text-white">Registered Name</div>
                            <div className="text-md text-indigo-200">{displayName}</div>
                          </div>
                          <div className={`rounded-full px-3 py-1 text-xs font-medium ${resultColorScheme.badge}`}>
                            {getVersionName(lookupResult.version)}
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="text-sm text-indigo-300 mb-2 font-medium">Address:</div>
                          <div className="bg-indigo-950/60 border border-indigo-700/30 rounded-lg p-3 font-mono text-cyan-100 select-all break-all">
                            {lookupResult.address}
                          </div>
                        </div>

                        {lookupResult.version === "2.5" && lookupResult.justRegistered && (
                          <div className="mt-4 p-4 bg-indigo-900/30 rounded-lg border border-indigo-700/30">
                            {indexingTransaction ? (
                              <div className="flex flex-col items-center justify-center py-2">
                                <div className="flex items-center mb-2">
                                  <svg className="animate-spin mr-3 h-5 w-5 text-purple-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  <span className="text-purple-200">Your transaction is being indexed...</span>
                                </div>
                                <p className="text-indigo-300 text-sm mt-1">This usually takes a few seconds</p>
                              </div>
                            ) : lookupResult.transaction_id ? (
                              <>
                                <p className="text-purple-200 mb-2">
                                  See transaction on Midenscan here:
                                </p>
                                <a
                                  href={`https://testnet.midenscan.com/tx/${lookupResult.transaction_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-300 hover:text-purple-100 font-mono flex items-center hover:underline"
                                >
                                  <span className="truncate">{lookupResult.transaction_id}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </>
                            ) : null}
                          </div>
                        )}

                        <div className="flex justify-end mt-4">
                          <button
                            onClick={copyAddress}
                            className="px-4 py-2 bg-indigo-800/60 hover:bg-indigo-700/60 rounded-lg transition flex items-center"
                            type="button"
                          >
                            {copied ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Copied
                              </>
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Not Registered / Register Block
                      <div className={`rounded-xl ${colorScheme.background} px-6 py-6 text-indigo-100 shadow-xl border-2 border-indigo-500/30`}>
                        {/* ... existing not registered / register form content ... */}
                        <div className="flex items-center mb-4">
                          <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-bold text-xl text-white">Name Not Registered</div>
                            <div className="text-md text-indigo-200">{displayName}</div>
                          </div>
                        </div>

                        {showAddressInput ? (
                          <>
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-indigo-200 mb-2">
                                Enter your address (must be 0x-prefixed hex, max 24 bytes):
                              </label>
                              <input
                                type="text"
                                value={address}
                                onChange={handleAddressChange}
                                placeholder="0x..."
                                className="w-full px-4 py-3 bg-indigo-950/60 border border-indigo-700/50 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition font-mono"
                              />
                            </div>
                            <div className="flex gap-3 mt-4">
                              <button
                                className="flex-1 py-3 rounded-lg bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-200 font-semibold shadow-lg focus:outline-none transition text-lg"
                                onClick={() => { setShowAddressInput(false); setAddress(''); }}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button
                                className={`flex-1 py-3 rounded-lg bg-gradient-to-r ${colorScheme.button} font-semibold text-white shadow-lg focus:outline-none transition text-lg ${loading || !address || !validateAddress(address) ? "opacity-40 cursor-not-allowed" : ""}`}
                                onClick={handleRegister}
                                disabled={loading || !address || !validateAddress(address)}
                                type="button"
                              >
                                {loading ? 'Registering...' : 'Register'}
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            className={`mt-3 w-full px-6 py-4 rounded-lg bg-gradient-to-r ${colorScheme.button} font-semibold text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition text-lg`}
                            onClick={() => setShowAddressInput(true)}
                            type="button"
                          >
                            Register
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </> /* End of Web 2.0/2.5 form and results wrapper */
          )}

          {/* Hint text */}
          {!loading && !hasSearched && !error && selected !== "3" && (
            <div className="text-center text-indigo-400/70 text-sm mt-2">
              Try searching for names like alice.miden or bob.miden
            </div>
          )}

          {/* Footer */}
          <footer className="mt-auto pt-10 text-center">
            <a
              href="https://github.com/0xMiden"
              className="text-indigo-300 hover:text-cyan-300 transition underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              Powered by Miden Blockchain Technology
            </a>
          </footer>
        </div>

        {/* CSS for toast animations */}
        <style jsx global>{`
          /* ... (keep existing styles) ... */
          html, body { min-height: 100%; height: 100%; background: linear-gradient(to bottom right, #1e1b4b, #581c87, #000000); overflow-x: hidden; }
          body { margin: 0; padding: 0; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes fadeOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-20px); } }
          .animate-fadeIn { animation: fadeIn 0.5s ease forwards; }
          .animate-fadeOut { animation: fadeOut 0.5s ease forwards; }
        `}</style>
      </div>

      {/* Lightbox Component - Simplified */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={current?.imageSrc ? [{ src: current.imageSrc }] : []}
        // No plugins array needed
        // Disable navigation buttons by rendering null
        render={{
          buttonPrev: () => null,
          buttonNext: () => null,
        }}
        styles={{ container: { backgroundColor: "rgba(200, 200, 200, 0.80)" } }} // Updated background color
      />
    </>
  );
}
