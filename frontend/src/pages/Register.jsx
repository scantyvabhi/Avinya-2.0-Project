import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "factory_owner",
    organization_name: "",
  });
  const [loading, setLoading] = useState(false);

  const handle = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success("Welcome aboard.");
      navigate("/app/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md" data-testid="register-form">
        <Link to="/" className="flex items-center gap-2.5 mb-8">
          <div className="w-7 h-7 bg-[#F97316] flex items-center justify-center font-display font-black text-black">S</div>
          <div>
            <div className="font-display font-bold tracking-tight">SENTINEL</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Predictive Ops</div>
          </div>
        </Link>

        <h1 className="font-display text-2xl font-bold">Create account</h1>
        <p className="text-sm text-muted-foreground mt-1">Set up your factory in under a minute.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="eyebrow">Full name</label>
            <input
              required value={form.full_name} onChange={handle("full_name")}
              data-testid="reg-name"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow">Email</label>
              <input
                type="email" required value={form.email} onChange={handle("email")}
                data-testid="reg-email"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
              />
            </div>
            <div>
              <label className="eyebrow">Password</label>
              <input
                type="password" required minLength={6} value={form.password} onChange={handle("password")}
                data-testid="reg-password"
                className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
              />
            </div>
          </div>
          <div>
            <label className="eyebrow">Organization</label>
            <input
              value={form.organization_name} onChange={handle("organization_name")}
              placeholder="Your factory / company name"
              data-testid="reg-org"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
            />
          </div>
          <div>
            <label className="eyebrow">Role</label>
            <select
              value={form.role} onChange={handle("role")}
              data-testid="reg-role"
              className="mt-1 w-full input-themed px-3 py-2.5 text-sm focus:outline-none focus:border-[#F97316]"
            >
              <option value="factory_owner">Factory Owner</option>
              <option value="technician">Technician</option>
            </select>
          </div>

          <button
            type="submit" disabled={loading}
            data-testid="reg-submit"
            className="w-full bg-[#F97316] hover:bg-[#EA580C] disabled:opacity-60 text-black font-medium py-2.5 transition-colors"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Already onboard? <Link to="/login" className="text-[#F97316] hover:underline" data-testid="link-login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
