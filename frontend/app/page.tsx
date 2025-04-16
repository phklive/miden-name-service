"use client";
import { useState } from 'react';

export default function Home() {
  const [mode, setMode] = useState<'register' | 'lookup'>('register');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lookupResult, setLookupResult] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Function to validate if the name ends with .miden
  const validateMidenName = (inputName: string): boolean => {
    return inputName.trim().toLowerCase().endsWith('.miden');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setError('');
    setLookupResult('');
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
    setError('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMidenName(name)) {
      setError('Name must end with .miden');
      return;
    }

    if (!address) {
      setError('Address is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Connect to your Rust server
      const response = await fetch(`http://localhost:3001/register?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Registration failed: ${errorText}`);
      }

      setName('');
      setAddress('');
      alert(`Successfully registered ${name}`);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Registration failed'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateMidenName(name)) {
      setError('Name must end with .miden');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`http://localhost:3001/lookup?name=${encodeURIComponent(name)}`, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lookup failed: ${errorText}`);
      }

      // When your server returns actual address data, parse it accordingly
      const data = await response.text();
      setLookupResult(data || "No address found");
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Lookup failed'}`);
      setLookupResult('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 text-white flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-4 font-sans">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-2/3 left-1/2 w-80 h-80 bg-indigo-500 rounded-full opacity-10 blur-3xl"></div>
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <div className="mb-2 inline-block">
          <span className="inline-block px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-indigo-200 text-lg tracking-wide font-light animate-pulse">
            welcome to
          </span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-extrabold mb-8 tracking-tight">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-300 to-indigo-300 drop-shadow-lg">
            Miden Name Service
          </span>
        </h1>

        <div className="backdrop-blur-lg bg-white/10 p-8 rounded-3xl shadow-2xl mb-10 border border-white/20 transition-all duration-500 hover:bg-white/15">
          <p className="text-lg sm:text-xl leading-relaxed text-indigo-100 font-light">
            <span className="font-medium text-white">Simplify your blockchain journey.</span> No more struggling with complex addresses like 0x298392...
            Register and look up human-readable names on the Miden blockchain, connecting with friends
            and services effortlessly. <span className="italic text-cyan-300">Your digital identity, reimagined.</span>
          </p>
        </div>

        {/* Toggle Buttons */}
        <div className="inline-flex p-1.5 rounded-2xl shadow-xl mb-8 bg-white/5 backdrop-blur-md border border-white/10" role="group">
          <button
            type="button"
            className={`mr-2 px-8 py-3.5 text-md font-medium rounded-xl ${mode === 'register'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'bg-white/5 text-gray-200 hover:bg-white/10'
              } transition-all duration-300`}
            onClick={() => {
              setMode('register');
              setError('');
              setLookupResult('');
            }}
          >
            Register a Name
          </button>
          <button
            type="button"
            className={`ml-2 px-8 py-3.5 text-md font-medium rounded-xl ${mode === 'lookup'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'bg-white/5 text-gray-200 hover:bg-white/10'
              } transition-all duration-300`}
            onClick={() => {
              setMode('lookup');
              setError('');
              setLookupResult('');
            }}
          >
            Lookup a Name
          </button>
        </div>

        {/* Conditional Form */}
        <div className="backdrop-blur-xl bg-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md mx-auto border border-white/20 hover:border-white/30 transition-all duration-500">
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-white text-sm font-medium">
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </span>
            </div>
          )}

          {mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-6">
              <div className="text-left">
                <label htmlFor="name" className="block text-md font-medium text-indigo-200 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={handleNameChange}
                  className={`w-full px-5 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:border-transparent text-white transition-all duration-300 placeholder:text-indigo-200/50 ${error ? 'border-red-500 focus:ring-red-400' : 'border-indigo-300/30 focus:ring-cyan-400'
                    }`}
                  placeholder="yourname.miden"
                  required
                />
                <p className="text-xs text-indigo-300 mt-1">Names must end with .miden (e.g., yourname.miden)</p>
              </div>
              <div className="text-left">
                <label htmlFor="address" className="block text-md font-medium text-indigo-200 mb-2">
                  Miden Address
                </label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={handleAddressChange}
                  className="w-full px-5 py-3 bg-white/5 border border-indigo-300/30 rounded-xl focus:ring-2 focus:ring-cyan-400 focus:border-transparent text-white transition-all duration-300 placeholder:text-indigo-200/50"
                  placeholder="0x..."
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-medium text-white transition-all duration-300 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transform hover:-translate-y-0.5"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Registering...
                  </span>
                ) : 'Register Name'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="text-left">
                <label htmlFor="lookupName" className="block text-md font-medium text-indigo-200 mb-2">
                  Name to Lookup
                </label>
                <input
                  type="text"
                  id="lookupName"
                  value={name}
                  onChange={handleNameChange}
                  className={`w-full px-5 py-3 bg-white/5 border rounded-xl focus:ring-2 focus:border-transparent text-white transition-all duration-300 placeholder:text-indigo-200/50 ${error ? 'border-red-500 focus:ring-red-400' : 'border-indigo-300/30 focus:ring-cyan-400'
                    }`}
                  placeholder="name.miden"
                  required
                />
                <p className="text-xs text-indigo-300 mt-1">Names must end with .miden (e.g., name.miden)</p>
              </div>
              {lookupResult && (
                <div className="mt-4 p-5 bg-gradient-to-r from-indigo-900/70 to-purple-900/70 backdrop-blur-xl rounded-xl border border-indigo-500/20">
                  <p className="text-sm text-cyan-300 font-medium">Address:</p>
                  <p className="text-indigo-100 font-mono break-all mt-1 tracking-wider">{lookupResult}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl font-medium text-white transition-all duration-300 shadow-lg shadow-indigo-500/30 disabled:opacity-50 transform hover:-translate-y-0.5"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Looking up...
                  </span>
                ) : 'Lookup Name'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-16 text-indigo-300 text-sm relative z-10">
        <a
          href='https://github.com/0xMiden'
          className="text-cyan-300 hover:text-cyan-200 transition-colors underline decoration-dotted"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Miden Blockchain Technology
        </a>
      </div>
    </div>
  );
}
