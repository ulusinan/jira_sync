import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Cloud, Server, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(email, password);
      toast.success('Giriş başarılı!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left side - Form */}
      <div className="login-form-container">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center relative">
              <Cloud className="w-6 h-6 text-primary absolute -left-0.5 -top-0.5" />
              <Server className="w-6 h-6 text-primary/60 absolute left-1.5 top-1.5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">JiraSync Pro</h1>
              <p className="text-sm text-muted-foreground">Cloud → On-Premise</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-2">Hoş Geldiniz</h2>
          <p className="text-muted-foreground">
            Jira senkronizasyon paneline erişmek için giriş yapın
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              placeholder="ornek@sirket.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="login-email-input"
              className="h-12"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password-input"
              className="h-12"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full h-12 text-base btn-press"
            disabled={loading}
            data-testid="login-submit-btn"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Giriş Yap
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-muted-foreground">
          Hesabınız yok mu?{' '}
          <Link 
            to="/register" 
            className="text-primary hover:underline font-medium"
            data-testid="register-link"
          >
            Kayıt Olun
          </Link>
        </p>
      </div>

      {/* Right side - Image */}
      <div 
        className="login-image"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1633174074875-f09b1b53ecf6?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxzZXJ2ZXIlMjBjbG91ZCUyMGNvbm5lY3Rpb24lMjBhYnN0cmFjdHxlbnwwfHx8fDE3Njc4MTk2MTF8MA&ixlib=rb-4.1.0&q=85')`
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-background/90" />
        <div className="absolute bottom-12 left-12 right-12 z-10">
          <div className="glass rounded-xl p-6">
            <p className="text-lg font-medium mb-2">Jira Cloud'dan On-Premise'e Sorunsuz Aktarım</p>
            <p className="text-sm text-muted-foreground">
              Proje eşleştirme, issue type mapping ve otomatik senkronizasyon özellikleriyle
              Jira geçiş sürecinizi kolaylaştırın.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
