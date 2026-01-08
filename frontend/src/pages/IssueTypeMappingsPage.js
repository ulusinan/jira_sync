import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  getCloudIssueTypes, 
  getOnPremIssueTypes, 
  getIssueTypeMappings, 
  createIssueTypeMapping,
  deleteIssueTypeMapping,
  getProjectMappings
} from '@/lib/api';
import { toast } from 'sonner';
import { 
  Cloud, 
  Server, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Loader2,
  Tags,
  AlertCircle,
  FolderSync
} from 'lucide-react';

export default function IssueTypeMappingsPage() {
  const [projectMappings, setProjectMappings] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [cloudTypes, setCloudTypes] = useState([]);
  const [onpremTypes, setOnpremTypes] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCloud, setSelectedCloud] = useState('');
  const [selectedOnPrem, setSelectedOnPrem] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjectMappings();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchIssueTypes();
      fetchMappings();
    }
  }, [selectedProject]);

  const fetchProjectMappings = async () => {
    setLoading(true);
    try {
      const response = await getProjectMappings();
      setProjectMappings(response.data);
      if (response.data.length > 0) {
        setSelectedProject(response.data[0].id);
      }
    } catch (error) {
      console.error('Project mappings fetch error:', error);
      if (error.response?.status === 404) {
        setError('Önce Ayarlar sayfasından Jira bağlantı bilgilerinizi girin.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchIssueTypes = async () => {
    setLoadingTypes(true);
    try {
      const [cloudRes, onpremRes] = await Promise.all([
        getCloudIssueTypes(),
        getOnPremIssueTypes()
      ]);
      setCloudTypes(cloudRes.data);
      setOnpremTypes(onpremRes.data);
      setError(null);
    } catch (error) {
      console.error('Issue type data fetch error:', error);
      setError('Issue type\'lar yüklenemedi. Jira bağlantısını kontrol edin.');
    } finally {
      setLoadingTypes(false);
    }
  };

  const fetchMappings = async () => {
    try {
      const response = await getIssueTypeMappings(selectedProject);
      setMappings(response.data);
    } catch (error) {
      console.error('Mappings fetch error:', error);
    }
  };

  const handleAddMapping = async () => {
    if (!selectedCloud || !selectedOnPrem) {
      toast.error('Lütfen her iki issue type\'ı da seçin');
      return;
    }

    setSaving(true);
    try {
      const response = await createIssueTypeMapping({
        project_mapping_id: selectedProject,
        cloud_issue_type: selectedCloud,
        onprem_issue_type: selectedOnPrem
      });
      setMappings([...mappings, response.data]);
      setSelectedCloud('');
      setSelectedOnPrem('');
      toast.success('Issue type eşleştirmesi eklendi');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Eşleştirme eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id) => {
    try {
      await deleteIssueTypeMapping(id);
      setMappings(mappings.filter(m => m.id !== id));
      toast.success('Eşleştirme silindi');
    } catch (error) {
      toast.error('Eşleştirme silinemedi');
    }
  };

  // Get selected project info
  const selectedProjectInfo = projectMappings.find(p => p.id === selectedProject);

  // Filter out already mapped cloud types for this project
  const availableCloudTypes = cloudTypes.filter(
    t => !mappings.find(m => m.cloud_issue_type === t.name)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="issue-type-mappings-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-1">Issue Type Eşleştirme</h1>
        <p className="text-muted-foreground">
          Her proje için Cloud issue type'larını On-Premise issue type'larıyla eşleştirin
        </p>
      </div>

      {projectMappings.length === 0 ? (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="flex items-center gap-4 p-6">
            <FolderSync className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-amber-500">Önce proje eşleştirmesi yapın</p>
              <p className="text-sm text-muted-foreground">Issue type eşleştirmesi yapmadan önce en az bir proje eşleştirmesi oluşturmalısınız.</p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-primary"
                onClick={() => window.location.href = '/project-mappings'}
              >
                Proje Eşleştirmeye Git →
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Project Selector */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FolderSync className="w-5 h-5 text-primary" />
                Proje Seçin
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                <div className="flex-1 w-full">
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger data-testid="project-selector" className="w-full">
                      <SelectValue placeholder="Proje seçin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projectMappings.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <Cloud className="w-4 h-4 text-blue-500" />
                            <span>{project.cloud_project_key}</span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <Server className="w-4 h-4 text-orange-500" />
                            <span>{project.onprem_project_key}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedProjectInfo && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Seçili: </span>
                      <span className="font-medium text-blue-500">{selectedProjectInfo.cloud_project_name}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium text-orange-500">{selectedProjectInfo.onprem_project_name}</span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {error ? (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="flex items-center gap-4 p-6">
                <AlertCircle className="w-8 h-8 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">{error}</p>
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
                    Yeni Issue Type Eşleştirmesi Ekle
                    {selectedProjectInfo && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        ({selectedProjectInfo.cloud_project_key} için)
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingTypes ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Issue type'lar yükleniyor...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
                      {/* Cloud Issue Type */}
                      <div className="flex-1 w-full space-y-2">
                        <Label className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-blue-500" />
                          Cloud Issue Type
                        </Label>
                        <Select value={selectedCloud} onValueChange={setSelectedCloud}>
                          <SelectTrigger data-testid="cloud-type-select">
                            <SelectValue placeholder="Issue type seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCloudTypes.map(type => (
                              <SelectItem key={type.name} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <ArrowRight className="w-6 h-6 text-muted-foreground hidden md:block shrink-0 mb-2" />

                      {/* On-Prem Issue Type */}
                      <div className="flex-1 w-full space-y-2">
                        <Label className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-orange-500" />
                          On-Premise Issue Type
                        </Label>
                        <Select value={selectedOnPrem} onValueChange={setSelectedOnPrem}>
                          <SelectTrigger data-testid="onprem-type-select">
                            <SelectValue placeholder="Issue type seçin..." />
                          </SelectTrigger>
                          <SelectContent>
                            {onpremTypes.map(type => (
                              <SelectItem key={type.name} value={type.name}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Button 
                        onClick={handleAddMapping} 
                        disabled={saving || !selectedCloud || !selectedOnPrem}
                        className="btn-press shrink-0"
                        data-testid="add-type-mapping-btn"
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
                  )}
                </CardContent>
              </Card>

              {/* Mappings List */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Tags className="w-5 h-5 text-primary" />
                    {selectedProjectInfo?.cloud_project_key} Projesi Issue Type Eşleştirmeleri ({mappings.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {mappings.length === 0 ? (
                    <div className="empty-state py-12">
                      <Tags />
                      <p>Bu proje için henüz issue type eşleştirmesi yok</p>
                      <p className="text-xs">Yukarıdan yeni eşleştirme ekleyin</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {mappings.map((mapping) => (
                        <div key={mapping.id} className="mapping-card m-0 rounded-none border-0 border-b last:border-b-0" data-testid={`type-mapping-${mapping.id}`}>
                          {/* Cloud */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                              <Cloud className="w-5 h-5 text-blue-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{mapping.cloud_issue_type}</p>
                              <p className="text-xs text-muted-foreground">Cloud</p>
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
                              <p className="font-medium truncate">{mapping.onprem_issue_type}</p>
                              <p className="text-xs text-muted-foreground">On-Premise</p>
                            </div>
                          </div>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMapping(mapping.id)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            data-testid={`delete-type-mapping-${mapping.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
