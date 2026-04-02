'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, Plus, Trash2, Loader2, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import type { PriceAlert } from '@/types';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCondition, setNewCondition] = useState<'BELOW' | 'ABOVE'>('BELOW');
  const [newPrice, setNewPrice] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch {
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }

  async function addAlert() {
    if (!newName.trim() || !newPrice) return;
    setAdding(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_name: newName,
          condition_type: newCondition,
          target_price: parseFloat(newPrice),
        }),
      });
      if (res.ok) {
        toast.success('Alert created');
        setNewName(''); setNewPrice('');
        fetchAlerts();
      }
    } catch {
      toast.error('Failed to create alert');
    } finally {
      setAdding(false);
    }
  }

  async function removeAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Bell className="w-8 h-8 text-orange-500" /> Price Alerts
        </h1>
        <p className="text-gray-400 mt-1">Get notified when cards hit your target price</p>
      </div>

      <Card className="bg-gray-900 border-gray-800">
        <CardHeader><CardTitle className="text-white text-base">Create Alert</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Card name (e.g. Charizard VMAX PSA 10)" className="bg-gray-800 border-gray-700 text-white flex-1 min-w-[200px]" />
            <Select value={newCondition} onValueChange={(v) => setNewCondition((v as 'BELOW' | 'ABOVE') ?? 'BELOW')}>
              <SelectTrigger className="w-[120px] bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BELOW">Drops below</SelectItem>
                <SelectItem value="ABOVE">Rises above</SelectItem>
              </SelectContent>
            </Select>
            <Input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} type="number" step="0.01" placeholder="$0.00" className="bg-gray-800 border-gray-700 text-white w-28" />
            <Button onClick={addAlert} disabled={adding || !newName.trim() || !newPrice} className="bg-orange-500 hover:bg-orange-600 text-white">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          No price alerts set. Create one above to start monitoring.
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert.id} className={`flex items-center gap-4 bg-gray-900 border rounded-lg p-4 ${alert.is_triggered ? 'border-orange-500' : 'border-gray-800'}`}>
              {alert.is_triggered ? (
                <BellRing className="w-5 h-5 text-orange-500 flex-shrink-0" />
              ) : (
                <Bell className="w-5 h-5 text-gray-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium">{alert.card_name}</p>
                <p className="text-gray-400 text-sm">
                  Alert when price {alert.condition_type === 'BELOW' ? 'drops below' : 'rises above'}{' '}
                  <span className="text-yellow-400 font-mono">${alert.target_price}</span>
                </p>
              </div>
              {alert.is_triggered && (
                <Badge className="bg-orange-500/20 text-orange-400">Triggered</Badge>
              )}
              <Button variant="ghost" size="sm" onClick={() => removeAlert(alert.id)} className="text-red-400 hover:text-red-300">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
