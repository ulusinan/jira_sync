import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getJiraSettings, saveJiraSettings, testJiraConnection } from '@/lib/api';
import { toast } from 'sonner';
import { 
  Settings, 
  Cloud, 
  Server, 
  Loader2,
  CheckCircle2,
  XCircle,
  Save,
  Wifi,
  Eye,
  EyeOff
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showCloudToken, setShowCloudToken] = useState(false);
  const [showOnPremPassword, setShowOnPremPassword] = useState(false);
  const [testResults, setTestResults] = useState(null);
  
  const [formData, setFormData] = useState({
    cloud_url: '',
    cloud_email: '',
    cloud_api_token: '',
    onprem_url: '',
    onprem_username: '',
    onprem_password: '',
    sync_interval_minutes: 15
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await getJiraSettings();
      if (response.data) {
        setFormData(prev => ({
          ...prev,
          cloud_url: response.data.cloud_url || '',
          cloud_email: response.data.cloud_email || '',
          onprem_url: response.data.onprem_url || '',
          onprem_username: response.data.onprem_username || '',
          sync_interval_minutes: response.data.sync_interval_minutes || 15
        }));
      }
    } catch (error) {
      console.error('Settings fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validation
    if (!formData.cloud_url || !formData.cloud_email || !formData.cloud_api_token) {
      toast.error('Lütfen tüm Cloud bilgilerini girin');
      return;
    }
    if (!formData.onprem_url || !formData.onprem_username || !formData.onprem_password) {
      toast.error('Lütfen tüm On-Premise bilgilerini girin');
      return;
    }

    setSaving(true);
    try {
      await saveJiraSettings(formData);
      toast.success('Ayarlar kaydedildi');
    } catch (error) {
      toast.error('Ayarlar kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const response = await testJiraConnection();
      setTestResults(response.data);
      if (response.data.cloud && response.data.onprem) {
        toast.success('Her iki bağlantı da başarılı!');
      } else {
        const errors = [];
        if (!response.data.cloud) errors.push('Jira Cloud');
        if (!response.data.onprem) errors.push('Jira On-Premise');
        toast.error(`Bağlantı hatası: ${errors.join(' ve ')}`);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Bağlantı testi başarısız. Önce ayarları kaydedin.';
      toast.error(errorMsg);
      setTestResults({ cloud: false, onprem: false, cloud_error: errorMsg, onprem_error: errorMsg });
    } finally {
      setTesting(false);
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
    <div className="space-y-8 animate-fade-in max-w-4xl" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1">Ayarlar</h1>
        <p className="text-muted-foreground">
          Jira Cloud ve On-Premise bağlantı ayarlarınızı yapılandırın
        </p>
      </div>

      {/* Cloud Settings */}
      <div className="form-section">
        <div className="form-section-title">
          <Cloud className="w-5 h-5 text-blue-500" />
          Jira Cloud Ayarları
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="cloud_url">Cloud URL</Label>
            <Input
              id="cloud_url"
              placeholder="https://your-domain.atlassian.net"
              value={formData.cloud_url}
              onChange={(e) => handleChange('cloud_url', e.target.value)}
              data-testid="cloud-url-input"
            />
            <p className="text-xs text-muted-foreground">
              Örnek: https://sirketiniz.atlassian.net
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cloud_email">E-posta</Label>
            <Input
              id="cloud_email"
              type="email"
              placeholder="admin@sirket.com"
              value={formData.cloud_email}
              onChange={(e) => handleChange('cloud_email', e.target.value)}
              data-testid="cloud-email-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="cloud_api_token">API Token</Label>
            <div className="relative">
              <Input
                id="cloud_api_token"
                type={showCloudToken ? 'text' : 'password'}
                placeholder="API Token"
                value={formData.cloud_api_token}
                onChange={(e) => handleChange('cloud_api_token', e.target.value)}
                data-testid="cloud-token-input"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCloudToken(!showCloudToken)}
              >
                {showCloudToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Atlassian API Token oluşturun →
              </a>
            </p>
          </div>
        </div>

        {testResults && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${testResults.cloud ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
            {testResults.cloud ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span className="text-sm">
              {testResults.cloud ? 'Cloud bağlantısı başarılı' : `Cloud bağlantı hatası: ${testResults.cloud_error}`}
            </span>
          </div>
        )}
      </div>

      {/* On-Premise Settings */}
      <div className="form-section">
        <div className="form-section-title">
          <Server className="w-5 h-5 text-orange-500" />
          Jira On-Premise Ayarları
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="onprem_url">On-Premise URL</Label>
            <Input
              id="onprem_url"
              placeholder="https://jira.sirket.com"
              value={formData.onprem_url}
              onChange={(e) => handleChange('onprem_url', e.target.value)}
              data-testid="onprem-url-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="onprem_username">Kullanıcı Adı</Label>
            <Input
              id="onprem_username"
              placeholder="admin"
              value={formData.onprem_username}
              onChange={(e) => handleChange('onprem_username', e.target.value)}
              data-testid="onprem-username-input"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="onprem_password">Şifre</Label>
            <div className="relative">
              <Input
                id="onprem_password"
                type={showOnPremPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={formData.onprem_password}
                onChange={(e) => handleChange('onprem_password', e.target.value)}
                data-testid="onprem-password-input"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowOnPremPassword(!showOnPremPassword)}
              >
                {showOnPremPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {testResults && (
          <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${testResults.onprem ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
            {testResults.onprem ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            <span className="text-sm">
              {testResults.onprem ? 'On-Premise bağlantısı başarılı' : `On-Premise bağlantı hatası: ${testResults.onprem_error}`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          onClick={handleTest}
          variant="outline"
          disabled={testing}
          className="btn-press"
          data-testid="test-connection-btn"
        >
          {testing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Wifi className="w-4 h-4 mr-2" />
          )}
          Bağlantıyı Test Et
        </Button>
        
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="btn-press"
          data-testid="save-settings-btn"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Ayarları Kaydet
        </Button>
      </div>
    </div>
  );
}
