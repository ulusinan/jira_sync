import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard, 
  FolderSync, 
  Tags, 
  ScrollText, 
  Settings, 
  LogOut,
  Cloud,
  Server,
  Menu,
  X,
  Users,
  Shield
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/project-mappings', label: 'Proje Eşleştirme', icon: FolderSync },
  { path: '/issue-type-mappings', label: 'Issue Type Eşleştirme', icon: Tags },
  { path: '/logs', label: 'Transfer Logları', icon: ScrollText },
  { path: '/users', label: 'Kullanıcı Yönetimi', icon: Users, adminOnly: true },
  { path: '/settings', label: 'Ayarlar', icon: Settings },
];

export const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || user?.role === 'admin'
  );

  return (
    <div className="app-layout">
      {/* Mobile menu button */}
      <button 
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-card border border-border md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        data-testid="mobile-menu-btn"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} data-testid="sidebar">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <div className="relative">
                <Cloud className="w-5 h-5 text-primary absolute -left-1 -top-1" />
                <Server className="w-5 h-5 text-primary/60 absolute left-1 top-1" />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold">JiraSync Pro</h1>
              <p className="text-xs text-muted-foreground">Cloud → On-Premise</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              data-testid={`nav-${item.path.replace('/', '')}`}
            >
              <item.icon size={20} />
              {item.label}
              {item.adminOnly && (
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
                  Admin
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              user?.role === 'admin' ? 'bg-amber-500/20 text-amber-600' : 'bg-primary/20 text-primary'
            }`}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                {user?.role === 'admin' && (
                  <Shield className="w-3 h-3 text-amber-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            onClick={logout}
            data-testid="logout-btn"
          >
            <LogOut size={18} />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="main-content">
        <div className="p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
