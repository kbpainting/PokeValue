'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WishlistItem } from '@/types';

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [newSet, setNewSet] = useState('');
  const [newTarget, setNewTarget] = useState('');

  useEffect(() => {
    fetchWishlist();
  }, []);

  async function fetchWishlist() {
    try {
      const res = await fetch('/api/wishlist');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name: newName,
          card_number: newNumber,
          set_name: newSet,
          target_price: newTarget ? parseFloat(newTarget) : null,
        }),
      });
      if (res.ok) {
        toast.success('Added to wishlist');
        setNewName(''); setNewNumber(''); setNewSet(''); setNewTarget('');
        fetchWishlist();
      }
    } catch {
      toast.error('Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' });
      toast.success('Removed from wishlist');
    } catch {
      fetchWishlist();
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Heart className="w-8 h-8 text-pink-500" /> Wishlist
        </h1>
        <p className="text-gray-400 mt-1">Track cards you want to acquire</p>
      </div>

      {/* Quick Add */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader><CardTitle className="text-white text-base">Quick Add</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Card name" className="bg-gray-800 border-gray-700 text-white flex-1 min-w-[150px]" />
            <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="#" className="bg-gray-800 border-gray-700 text-white w-20" />
            <Input value={newSet} onChange={(e) => setNewSet(e.target.value)} placeholder="Set" className="bg-gray-800 border-gray-700 text-white w-40" />
            <Input value={newTarget} onChange={(e) => setNewTarget(e.target.value)} type="number" step="0.01" placeholder="Target $" className="bg-gray-800 border-gray-700 text-white w-28" />
            <Button onClick={addItem} disabled={adding || !newName.trim()} className="bg-pink-500 hover:bg-pink-600 text-white">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Wishlist items */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          Your wishlist is empty. Add cards you want to track above.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-lg p-4">
              <Heart className="w-5 h-5 text-pink-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">{item.card_name}</p>
                <p className="text-gray-400 text-sm">
                  {item.set_name}{item.card_number ? ` #${item.card_number}` : ''}
                  {item.grading_company !== 'RAW' && ` · ${item.grading_company} ${item.target_grade || ''}`}
                </p>
              </div>
              {item.target_price && (
                <Badge className="bg-yellow-500/20 text-yellow-400">
                  Target: ${item.target_price}
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
