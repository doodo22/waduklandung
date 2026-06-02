'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { APP_NAME } from '@/lib/constants';
import { Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { setAuth } = useAuthStore();

  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.post('/auth/login', {
          username: form.username,
          password: form.password,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Login gagal');
          return;
        }
        setAuth(data.user, data.token);
      } else {
        if (!form.name) {
          setError('Nama lengkap wajib diisi');
          return;
        }
        const res = await api.post('/auth/register', {
          username: form.username,
          password: form.password,
          name: form.name,
          phone: form.phone,
          address: form.address,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Registrasi gagal');
          return;
        }
        setIsLogin(true);
        setError('');
        setForm({ username: '', password: '', name: '', phone: '', address: '' });
        alert('Registrasi berhasil! Silakan menunggu verifikasi admin sebelum login.');
      }
    } catch {
      setError('Terjadi kesalahan jaringan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 relative">
            <Image
              src="/logo.png"
              alt="Waduk Landung Logo"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-wide">WADUK LANDUNG</h1>
          <p className="text-sm text-slate-500 mt-1">Sistem Manajemen RT Digital</p>
        </div>

        <Card className="rounded-xl shadow-sm border border-slate-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{isLogin ? 'Masuk' : 'Daftar Akun'}</CardTitle>
            <CardDescription className="text-sm">
              {isLogin
                ? 'Masuk dengan username dan password Anda'
                : 'Buat akun baru untuk mengakses sistem'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input
                    id="name"
                    placeholder="Masukkan nama lengkap"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="h-11"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Masukkan username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4.5 h-4.5" />
                    ) : (
                      <Eye className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">No. Telepon</Label>
                    <Input
                      id="phone"
                      placeholder="Masukkan no. telepon"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Alamat</Label>
                    <Input
                      id="address"
                      placeholder="Masukkan alamat"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="h-11"
                    />
                  </div>
                </>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white"
                disabled={loading}
              >
                {loading ? 'Memproses...' : isLogin ? 'Masuk' : 'Daftar'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-400 text-center mt-6">
          © 2026 Waduk Landung — Sistem Manajemen RT Digital
        </p>
      </div>
    </div>
  );
}
