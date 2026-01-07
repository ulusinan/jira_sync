import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  AlertCircle
} from 'lucide-react';

export default function ProjectMappingsPage() {
  const [cloudProjects, setCloudProjects] = useState([]);
  const [onpremProjects, setOnpremProjects] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCloud, setSelectedCloud] = useState('');
  const [selectedOnPrem, setSelectedOnPrem] = useState('');
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
      if (error.response?.status === 404) {
        setError('Önce Ayarlar sayfasından Jira bağlantı bilgilerinizi girin.');
      } else {
        setError('Jira bağlantısı kurulamadı. Ayarları kontrol edin.');
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
        is_active: true
      });
      setMappings([...mappings, response.data]);
      setSelectedCloud('');
      setSelectedOnPrem('');
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
          {/* Add New Mapping */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Yeni Eşleştirme Ekle
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                    <div key={mapping.id} className="mapping-card m-0 rounded-none border-0 border-b last:border-b-0" data-testid={`mapping-${mapping.id}`}>
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
