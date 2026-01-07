import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDashboardStats, getRecentLogs, triggerSync, getSyncStatus } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FolderSync,
  RefreshCw,
  Loader2,
  Cloud,
  Server,
  ArrowRight,
  Wifi,
  WifiOff
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, logsRes, syncRes] = await Promise.all([
        getDashboardStats(),
        getRecentLogs(),
        getSyncStatus()
      ]);
      setStats(statsRes.data);
      setRecentLogs(logsRes.data);
      setSyncStatus(syncRes.data);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      toast.success('Senkronizasyon başlatıldı');
      setTimeout(fetchData, 3000);
    } catch (error) {
      toast.error('Senkronizasyon başlatılamadı');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: tr });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">Senkronizasyon durumunu takip edin</p>
        </div>
        <div className="flex items-center gap-3">
          {stats?.is_connected ? (
            <div className="connection-indicator connected">
              <Wifi size={16} />
              <span>Bağlı</span>
            </div>
          ) : (
            <div className="connection-indicator disconnected">
              <WifiOff size={16} />
              <span>Bağlantı Yok</span>
            </div>
          )}
          <Button 
            onClick={handleSync} 
            disabled={syncing || !stats?.is_connected}
            className="btn-press"
            data-testid="manual-sync-btn"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Manuel Senkronizasyon
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Aktif Eşleştirme</span>
            <FolderSync className="w-5 h-5 text-primary" />
          </div>
          <div className="stat-value text-primary">{stats?.active_mappings || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">/ {stats?.total_mappings || 0} toplam</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Başarılı Transfer</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="stat-value text-emerald-500">{stats?.total_synced || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">issue aktarıldı</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Hatalı Transfer</span>
            <XCircle className="w-5 h-5 text-destructive" />
          </div>
          <div className="stat-value text-destructive">{stats?.total_errors || 0}</div>
          <p className="text-xs text-muted-foreground mt-1">hata oluştu</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Son Senkronizasyon</span>
            <Clock className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="stat-value text-lg">{formatDate(stats?.last_sync)}</div>
          <p className="text-xs text-muted-foreground mt-1">Sonraki: 15 dk içinde</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Flow */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Senkronizasyon Akışı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Jira Cloud</p>
                  <p className="text-xs text-muted-foreground">Kaynak</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 px-4">
                <div className="h-px w-8 bg-border" />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${syncing ? 'bg-primary animate-pulse-ring' : 'bg-primary/10'}`}>
                  <ArrowRight className={`w-5 h-5 ${syncing ? 'text-primary-foreground' : 'text-primary'}`} />
                </div>
                <div className="h-px w-8 bg-border" />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Server className="w-6 h-6 text-orange-500" />
                </div>
                <div>
                  <p className="font-medium">Jira On-Premise</p>
                  <p className="text-xs text-muted-foreground">Hedef</p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-primary">{stats?.active_mappings || 0}</p>
                <p className="text-xs text-muted-foreground">Aktif Proje</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-emerald-500">{stats?.total_synced || 0}</p>
                <p className="text-xs text-muted-foreground">Aktarıldı</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">{stats?.total_pending || 0}</p>
                <p className="text-xs text-muted-foreground">Beklemede</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Logs */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Son Transferler
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentLogs.length === 0 ? (
              <div className="empty-state py-8">
                <Activity />
                <p>Henüz transfer yok</p>
              </div>
            ) : (
              <div className="max-h-[300px] overflow-auto">
                {recentLogs.map((log) => (
                  <div key={log.id} className="log-entry">
                    <div className={`log-status ${log.status}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">{log.cloud_issue_key}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className={log.onprem_issue_key ? 'text-emerald-500' : 'text-muted-foreground'}>
                          {log.onprem_issue_key || '-'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {log.cloud_issue_summary}
                      </p>
                    </div>
                    <Badge 
                      variant="secondary"
                      className={`shrink-0 ${
                        log.status === 'success' ? 'badge-success' : 
                        log.status === 'failed' ? 'badge-error' : 'badge-warning'
                      }`}
                    >
                      {log.status === 'success' ? 'Başarılı' : 
                       log.status === 'failed' ? 'Hata' : 'Beklemede'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
