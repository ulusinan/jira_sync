import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  getAllUsers,
  createUserByAdmin,
  updateUserRole,
  resetUserPassword,
  deleteUser
} from '@/lib/api';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Shield,
  ShieldOff,
  KeyRound,
  Trash2,
  Loader2,
  Settings,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dialog states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Form states
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: '' });
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Users fetch error:', error);
      if (error.response?.status === 403) {
        setError('Bu sayfaya erişim için admin yetkisi gerekli.');
      } else {
        setError('Kullanıcılar yüklenirken hata oluştu.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    if (newUser.password.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }

    setSaving(true);
    try {
      const response = await createUserByAdmin({
        email: newUser.email,
        name: newUser.name,
        password: newUser.password,
        role: newUser.role || null
      });
      setUsers([...users, response.data]);
      setShowAddUser(false);
      setNewUser({ email: '', name: '', password: '', role: '' });
      toast.success('Kullanıcı oluşturuldu');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kullanıcı oluşturulamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole || null);
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole || null } : u
      ));
      toast.success('Rol güncellendi');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Rol güncellenemedi');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Şifre en az 6 karakter olmalı');
      return;
    }

    setSaving(true);
    try {
      await resetUserPassword(selectedUser.id, newPassword);
      setShowResetPassword(false);
      setNewPassword('');
      setSelectedUser(null);
      toast.success('Şifre sıfırlandı');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Şifre sıfırlanamadı');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    setSaving(true);
    try {
      await deleteUser(selectedUser.id);
      setUsers(users.filter(u => u.id !== selectedUser.id));
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      toast.success('Kullanıcı silindi');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kullanıcı silinemedi');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'dd MMM yyyy HH:mm', { locale: tr });
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

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center gap-4 p-6">
          <AlertCircle className="w-8 h-8 text-destructive shrink-0" />
          <div>
            <p className="font-medium text-destructive">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in" data-testid="user-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1">Kullanıcı Yönetimi</h1>
          <p className="text-muted-foreground">
            Kullanıcıları yönetin ve rol atayın
          </p>
        </div>
        <Button onClick={() => setShowAddUser(true)} data-testid="add-user-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          Yeni Kullanıcı
        </Button>
      </div>

      {/* Users List */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Kullanıcılar ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 ? (
            <div className="empty-state py-12">
              <Users />
              <p>Henüz kullanıcı yok</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users.map((user) => (
                <div 
                  key={user.id} 
                  className="p-4 hover:bg-muted/30 transition-colors"
                  data-testid={`user-${user.id}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    {/* User Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                        user.role === 'admin' ? 'bg-amber-500/20 text-amber-500' : 'bg-primary/10 text-primary'
                      }`}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{user.name}</p>
                          {user.role === 'admin' && (
                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                              <Shield className="w-3 h-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">Sen</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Kayıt: {formatDate(user.created_at)}</span>
                          {user.has_jira_settings && (
                            <span className="flex items-center gap-1 text-emerald-500">
                              <Settings className="w-3 h-3" />
                              Jira bağlı
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Role Select */}
                      <Select
                        value={user.role || 'user'}
                        onValueChange={(value) => handleRoleChange(user.id, value === 'user' ? null : value)}
                        disabled={user.id === currentUser?.id}
                      >
                        <SelectTrigger className="w-32" data-testid={`role-select-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <ShieldOff className="w-4 h-4" />
                              Kullanıcı
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Admin
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      {/* Reset Password */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetPassword(true);
                        }}
                        title="Şifre Sıfırla"
                        data-testid={`reset-password-${user.id}`}
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>

                      {/* Delete User */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedUser(user);
                          setShowDeleteConfirm(true);
                        }}
                        disabled={user.id === currentUser?.id}
                        className="text-muted-foreground hover:text-destructive"
                        title="Kullanıcıyı Sil"
                        data-testid={`delete-user-${user.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
            <DialogDescription>
              Sisteme yeni bir kullanıcı ekleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ad Soyad</Label>
              <Input
                id="name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Ahmet Yılmaz"
                data-testid="new-user-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="ahmet@firma.com"
                data-testid="new-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="En az 6 karakter"
                data-testid="new-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={newUser.role || 'user'}
                onValueChange={(value) => setNewUser({ ...newUser, role: value === 'user' ? '' : value })}
              >
                <SelectTrigger data-testid="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Kullanıcı</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              İptal
            </Button>
            <Button onClick={handleAddUser} disabled={saving} data-testid="create-user-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şifre Sıfırla</DialogTitle>
            <DialogDescription>
              {selectedUser?.name} için yeni şifre belirleyin
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Yeni Şifre</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="En az 6 karakter"
                data-testid="new-password-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowResetPassword(false);
              setNewPassword('');
            }}>
              İptal
            </Button>
            <Button onClick={handleResetPassword} disabled={saving} data-testid="confirm-reset-password">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Şifreyi Sıfırla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kullanıcıyı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{selectedUser?.name}</strong> kullanıcısını silmek istediğinize emin misiniz?
              <br /><br />
              Bu işlem geri alınamaz. Kullanıcının tüm Jira ayarları, proje eşleştirmeleri ve transfer logları silinecektir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-user"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
