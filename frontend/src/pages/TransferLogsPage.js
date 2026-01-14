import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getTransferLogs, getLogStats, retryTransferLog, retryAllFailedLogs } from '@/lib/api';
import { toast } from 'sonner';
import { 
  ScrollText, 
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Filter,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function TransferLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ pending: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [retryingId, setRetryingId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const [logsRes, statsRes] = await Promise.all([
        getTransferLogs(params),
        getLogStats()
      ]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Logs fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (logId) => {
    setRetryingId(logId);
    try {
      const response = await retryTransferLog(logId);
      toast.success(`Başarıyla aktarıldı: ${response.data.onprem_issue_key}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Tekrar deneme başarısız');
      fetchData();
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    setRetryingAll(true);
    try {
      const response = await retryAllFailedLogs();
      toast.success(response.data.message);
      // Wait a bit then refresh
      setTimeout(fetchData, 3000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Toplu tekrar deneme başarısız');
    } finally {
      setRetryingAll(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm:ss', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <Badge className="badge-success">Başarılı</Badge>;
      case 'failed':
        return <Badge className="badge-error">Hata</Badge>;
      default:
        return <Badge className="badge-warning">Beklemede</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in" data-testid="transfer-logs-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Transfer Logları</h1>
          <p className="text-muted-foreground">
            Tüm issue transferlerinin detaylı kayıtları
          </p>
        </div>
        <div className="flex gap-2">
          {stats.failed > 0 && (
            <Button 
              variant="outline"
              onClick={handleRetryAll}
              disabled={retryingAll}
              className="shrink-0"
              data-testid="retry-all-btn"
            >
              {retryingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Tümünü Tekrar Dene ({stats.failed})
            </Button>
          )}
          <Button 
            variant="outline" 
            onClick={fetchData}
            className="shrink-0"
            data-testid="refresh-logs-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className={`border-border cursor-pointer transition-colors ${statusFilter === 'success' ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'success' ? 'all' : 'success')}
          data-testid="filter-success"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">{stats.success}</p>
              <p className="text-sm text-muted-foreground">Başarılı</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-border cursor-pointer transition-colors ${statusFilter === 'failed' ? 'border-destructive/50 bg-destructive/5' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
          data-testid="filter-failed"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
              <p className="text-sm text-muted-foreground">Hatalı</p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`border-border cursor-pointer transition-colors ${statusFilter === 'pending' ? 'border-amber-500/50 bg-amber-500/5' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          data-testid="filter-pending"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">Beklemede</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Info */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>
            Filtre: <span className="font-medium text-foreground">{
              statusFilter === 'success' ? 'Başarılı' :
              statusFilter === 'failed' ? 'Hatalı' : 'Beklemede'
            }</span>
          </span>
          <Button 
            variant="link" 
            className="p-0 h-auto text-primary"
            onClick={() => setStatusFilter('all')}
          >
            Temizle
          </Button>
        </div>
      )}

      {/* Logs Table */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            Transfer Kayıtları ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state py-12">
              <ScrollText />
              <p>Henüz transfer kaydı yok</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Durum</th>
                    <th>Cloud Issue</th>
                    <th>On-Prem Issue</th>
                    <th>Özet</th>
                    <th>Tarih</th>
                    <th>Hata / İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} data-testid={`log-${log.id}`}>
                      <td>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          {getStatusBadge(log.status)}
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-primary font-medium">
                          {log.cloud_issue_key}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <span className={`font-mono ${log.onprem_issue_key ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}`}>
                            {log.onprem_issue_key || '-'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <p className="max-w-xs truncate text-sm">
                          {log.cloud_issue_summary}
                        </p>
                      </td>
                      <td>
                        <span className="text-sm text-muted-foreground font-mono">
                          {formatDate(log.created_at)}
                        </span>
                      </td>
                      <td>
                        {log.status === 'failed' ? (
                          <div className="flex items-center gap-2">
                            <p className="max-w-xs truncate text-sm text-destructive" title={log.error_message}>
                              {log.error_message?.substring(0, 50)}...
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRetry(log.id)}
                              disabled={retryingId === log.id}
                              data-testid={`retry-${log.id}`}
                            >
                              {retryingId === log.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              <span className="ml-1">Tekrar</span>
                            </Button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
