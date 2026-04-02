'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Shield, BarChart3, Search } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center text-black font-bold text-sm">
              PV
            </div>
            <span className="text-xl font-bold text-white">PokeValue</span>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-300">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6">
        <div className="py-24 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Know What Your <br />
            <span className="text-yellow-500">Slabs Are Worth</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Track your entire Pokemon graded slab collection with real-time
            comps from eBay, TCGPlayer, and PriceCharting. PSA, CGC, BGS, TAG, and Raw.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold text-lg px-8 py-6">
              Start Tracking Your Collection
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pb-24">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <Search className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Auto Cert Lookup</h3>
            <p className="text-gray-400 text-sm">
              Enter your cert number and we auto-pull the slab image from PSA, CGC, BGS, or TAG.
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <TrendingUp className="w-10 h-10 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Live Market Comps</h3>
            <p className="text-gray-400 text-sm">
              See last 10 sold on eBay, TCGPlayer prices, and PriceCharting data for every card.
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <BarChart3 className="w-10 h-10 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Portfolio Analytics</h3>
            <p className="text-gray-400 text-sm">
              Charts, graphs, and metrics. Total value, grade distribution, set breakdowns, and more.
            </p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <Shield className="w-10 h-10 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Population Data</h3>
            <p className="text-gray-400 text-sm">
              Graded population counts so you know how rare your slabs really are.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
