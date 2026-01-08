import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  getCloudProjects, 
  getOnPremProjects, 
  getProjectMappings, 
  createProjectMapping,
  deleteProjectMapping,
  toggleProjectMapping
} from '@/lib/api';
import { toast } from 'sonner';
import { 
  Cloud, 
  Server, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Loader2,
  FolderSync,
  AlertCircle,
  CalendarIcon,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function ProjectMappingsPage() {
  const [cloudProjects, setCloudProjects] = useState([]);
  const [onpremProjects, setOnpremProjects] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCloud, setSelectedCloud] = useState('');
  const [selectedOnPrem, setSelectedOnPrem] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cloudRes, onpremRes, mappingsRes] = await Promise.all([
        getCloudProjects(),
        getOnPremProjects(),
        getProjectMappings()
      ]);
      setCloudProjects(cloudRes.data);
      setOnpremProjects(onpremRes.data);
      setMappings(mappingsRes.data);
    } catch (error) {
      console.error('Project data fetch error:', error);
      const errorDetail = error.response?.data?.detail || error.message;
      if (error.response?.status === 404) {
        setError('Önce Ayarlar sayfasından Jira bağlantı bilgilerinizi girin.');
      } else if (error.response?.status === 500) {
        setError(`Jira'dan proje listesi alınamadı: ${errorDetail}`);
      } else {
        setError(`Bağlantı hatası: ${errorDetail}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async () => {
    if (!selectedCloud || !selectedOnPrem) {
      toast.error('Lütfen her iki projeyi de seçin');
      return;
    }

    const cloudProject = cloudProjects.find(p => p.key === selectedCloud);
    const onpremProject = onpremProjects.find(p => p.key === selectedOnPrem);

    if (!cloudProject || !onpremProject) {
      toast.error('Proje bulunamadı');
      return;
    }

    setSaving(true);
    try {
      const response = await createProjectMapping({
        cloud_project_key: cloudProject.key,
        cloud_project_name: cloudProject.name,
        onprem_project_key: onpremProject.key,
        onprem_project_name: onpremProject.name,
        start_date: startDate ? startDate.toISOString() : null,
        is_active: true
      });
      setMappings([...mappings, response.data]);
      setSelectedCloud('');
      setSelectedOnPrem('');
      setStartDate(null);
      toast.success('Proje eşleştirmesi eklendi');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Eşleştirme eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id) => {
    try {
      await deleteProjectMapping(id);
      setMappings(mappings.filter(m => m.id !== id));
      toast.success('Eşleştirme silindi');
    } catch (error) {
      toast.error('Eşleştirme silinemedi');
    }
  };

  const handleToggleMapping = async (id) => {
    try {
      const response = await toggleProjectMapping(id);
      setMappings(mappings.map(m => 
        m.id === id ? { ...m, is_active: response.data.is_active } : m
      ));
      toast.success('Durum güncellendi');
    } catch (error) {
      toast.error('Durum güncellenemedi');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'dd MMM yyyy', { locale: tr });
    } catch {
      return dateStr;
    }
  };

  // Filter out already mapped cloud projects
  const availableCloudProjects = cloudProjects.filter(
    p => !mappings.find(m => m.cloud_project_key === p.key)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="project-mappings-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1">Proje Eşleştirme</h1>
        <p className="text-muted-foreground">
          Cloud projelerini On-Premise projeleriyle eşleştirin
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-4 p-6">
            <AlertCircle className="w-8 h-8 text-destructive shrink-0" />
            <div>
              <p className="font-medium text-destructive">{error}</p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-primary"
                onClick={() => window.location.href = '/settings'}
              >
                Ayarlara Git →
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Info Box */}
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="flex items-start gap-4 p-4">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-blue-500 mb-1">Senkronizasyon Kuralları</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Sadece <span className="text-foreground font-medium">Issue Type eşleştirmesi yapılan</span> issue'lar senkronize olur</li>
                  <li>Başlangıç tarihi belirlerseniz, sadece o tarihten sonra oluşturulan issue'lar senkronize olur</li>
                  <li>Proje eşleştirmesi yaptıktan sonra Issue Type Eşleştirme sayfasından issue type'ları eşleştirmeyi unutmayın</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Add New Mapping */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Yeni Eşleştirme Ekle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                  {/* Cloud Project */}
                  <div className="flex-1 w-full space-y-2">
                    <Label className="flex items-center gap-2">
                      <Cloud className="w-4 h-4 text-blue-500" />
                      Cloud Proje
                    </Label>
                    <Select value={selectedCloud} onValueChange={setSelectedCloud}>
                      <SelectTrigger data-testid="cloud-project-select">
                        <SelectValue placeholder="Proje seçin..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCloudProjects.map(project => (
                          <SelectItem key={project.key} value={project.key}>
                            {project.key} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block shrink-0 mb-2" />

                  {/* On-Prem Project */}
                  <div className="flex-1 w-full space-y-2">
                    <Label className="flex items-center gap-2">
                      <Server className="w-4 h-4 text-orange-500" />
                      On-Premise Proje
                    </Label>
                    <Select value={selectedOnPrem} onValueChange={setSelectedOnPrem}>
                      <SelectTrigger data-testid="onprem-project-select">
                        <SelectValue placeholder="Proje seçin..." />
                      </SelectTrigger>
                      <SelectContent>
                        {onpremProjects.map(project => (
                          <SelectItem key={project.key} value={project.key}>
                            {project.key} - {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                  <div className="flex-1 w-full space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                      Başlangıç Tarihi (Opsiyonel)
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="start-date-picker"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, 'dd MMMM yyyy', { locale: tr }) : 'Tarih seçin...'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Bu tarihten sonra oluşturulan issue'lar senkronize olacak. Boş bırakırsanız tüm issue'lar senkronize olur.
                    </p>
                  </div>

                  <Button 
                    onClick={handleAddMapping} 
                    disabled={saving || !selectedCloud || !selectedOnPrem}
                    className="btn-press shrink-0"
                    data-testid="add-mapping-btn"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Ekle
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mappings List */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-primary" />
                Mevcut Eşleştirmeler ({mappings.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {mappings.length === 0 ? (
                <div className="empty-state py-12">
                  <FolderSync />
                  <p>Henüz eşleştirme yok</p>
                  <p className="text-xs">Yukarıdan yeni eşleştirme ekleyin</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {mappings.map((mapping) => (
                    <div key={mapping.id} className="p-4 hover:bg-muted/30 transition-colors" data-testid={`mapping-${mapping.id}`}>
                      <div className="flex items-center justify-between gap-4">
                        {/* Cloud */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <Cloud className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{mapping.cloud_project_key}</p>
                            <p className="text-xs text-muted-foreground truncate">{mapping.cloud_project_name}</p>
                          </div>
                        </div>

                        {/* Arrow */}
                        <div className="mapping-arrow">
                          <ArrowRight className="w-5 h-5" />
                        </div>

                        {/* On-Prem */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Server className="w-5 h-5 text-orange-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{mapping.onprem_project_key}</p>
                            <p className="text-xs text-muted-foreground truncate">{mapping.onprem_project_name}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={mapping.is_active}
                              onCheckedChange={() => handleToggleMapping(mapping.id)}
                              data-testid={`toggle-mapping-${mapping.id}`}
                            />
                            <span className={`text-xs ${mapping.is_active ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {mapping.is_active ? 'Aktif' : 'Pasif'}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMapping(mapping.id)}
                            className="text-muted-foreground hover:text-destructive"
                            data-testid={`delete-mapping-${mapping.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Date Info */}
                      {mapping.start_date && (
                        <div className="mt-3 ml-13 flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarIcon className="w-3 h-3" />
                          <span>
                            <span className="font-medium text-foreground">{formatDate(mapping.start_date)}</span> tarihinden sonraki issue'lar senkronize olacak
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
