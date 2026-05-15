import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("demo@predmaint.io");
  const [password, setPassword] = useState("Demo@1234");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Authenticated. Welcome.");
      navigate("/app/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="hidden md:flex md:w-1/2 bg-grid border-r border-border items-center justify-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#F97316] flex items-center justify-center font-display font-black text-black">S</div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight">SENTINEL</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Predictive Ops</div>
            </div>
          </div>
          <h2 className="mt-12 font-display text-3xl font-bold leading-tight">
            Step inside <span className="text-[#F97316]">your control room.</span>
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Every sensor stream from every machine — correlated, scored and explained by AI.
          </p>
          <div className="mt-10 panel">
            <div className="panel-header"><div className="eyebrow">Demo Access</div></div>
            <div className="panel-body text-xs font-mono space-y-2">
              <div>
                <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Factory Owner</div>
                <div>demo@predmaint.io · Demo@1234</div>
              </div>
              <div className="pt-2 border-t border-border">
                <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Technician</div>
                <div>tech@predmaint.io · Tech@1234</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <h1 className="font-display text-2xl font-bold">Sign in</h1>
          <p className="text-sm text-muted-foreground mt-1">Access your predictive ops dashboard.</p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="eyebrow">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="login-email"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div>
              <label className="eyebrow">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              data-testid="login-submit"
              className="w-full bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 text-black font-medium py-2.5 transition-colors"
            >
              {loading ? "Authenticating…" : "Enter control room"}
            </button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            No account? <Link to="/register" className="text-[#F97316] hover:underline" data-testid="link-register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
