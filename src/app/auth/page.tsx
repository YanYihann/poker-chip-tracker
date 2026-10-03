"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { WarningCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { useLanguage } from "@/components/i18n/language-provider";
import { AppTopBar } from "@/components/layout/app-top-bar";
import { loginAccount, registerAccount } from "@/features/auth/api";

type AuthMode = "login" | "register";

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") || "/online";
  const redirectTo = next.startsWith("/") && !next.startsWith("//") ? next : "/online";
  const { isZh } = useLanguage();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = email.trim().length > 3 && password.length >= 8 && (mode === "login" || username.trim().length >= 1);

  return <main className="app-shell auth-shell">
    <AppTopBar title={isZh ? "账户" : "Account"} />
    <section className="auth-layout">
      <div className="auth-form-area">
        <div className="auth-form-heading"><h1>{mode === "login" ? isZh ? "登录" : "SIGN IN" : isZh ? "注册" : "SIGN UP"}</h1></div>
        <div className="auth-tabs" role="group" aria-label={isZh ? "账户操作" : "Account action"}>
          {(["login", "register"] as const).map((tab) => <button key={tab} type="button" aria-pressed={mode === tab} disabled={loading} onClick={() => { setMode(tab); setError(null); }}>
            {tab === "login" ? isZh ? "登录" : "Sign in" : isZh ? "注册" : "Sign up"}
          </button>)}
        </div>
        <form className="ui-form" aria-busy={loading} onSubmit={async (event) => {
          event.preventDefault();
          if (!canSubmit || loading) return;
          setLoading(true); setError(null);
          try {
            if (mode === "login") await loginAccount({ email: email.trim(), password });
            else await registerAccount({ email: email.trim(), password, username: username.trim() });
            router.push(redirectTo);
          } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : isZh ? "暂时无法登录，请重试。" : "Unable to sign in. Please try again.");
          } finally { setLoading(false); }
        }}>
          <label className="form-field"><span>{isZh ? "邮箱" : "Email"}</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={loading} />
          </label>
          <label className="form-field"><span>{isZh ? "密码" : "Password"}</span>
            <div className="password-field">
              <input aria-label={isZh ? "密码" : "Password"} type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isZh ? "至少 8 个字符" : "At least 8 characters"} disabled={loading} />
              <button type="button" disabled={loading} aria-label={showPassword ? isZh ? "隐藏密码" : "Hide password" : isZh ? "显示密码" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}</button>
            </div>
          </label>
          {mode === "register" && <label className="form-field register-field"><span>{isZh ? "玩家昵称" : "Player name"}</span>
            <input type="text" autoComplete="nickname" maxLength={24} required value={username} onChange={(e) => setUsername(e.target.value)} placeholder={isZh ? "牌桌上如何称呼你" : "Your name at the table"} disabled={loading} />
          </label>}
          {error && <p className="form-error" role="alert"><WarningCircle size={20} aria-hidden="true" />{error}</p>}
          <button type="submit" className="button-primary" disabled={!canSubmit || loading}>
            {loading ? isZh ? "连接中…" : "Connecting…" : mode === "login" ? isZh ? "登录" : "Sign in" : isZh ? "注册" : "Create account"}<ArrowRight size={20} aria-hidden="true" />
          </button>
        </form>
        <div className="auth-local-entry">
          <Link href="/local">{isZh ? "本地记分（免登录）" : "Local game · No account"}<ArrowRight size={18} aria-hidden="true" /></Link>
          <Link href="/online">{isZh ? "返回大厅" : "Back to menu"}</Link>
        </div>
      </div>
    </section>
  </main>;
}

export default function AuthPage() {
  return <Suspense fallback={<main className="app-shell auth-shell"><div className="loading-skeleton" /></main>}><AuthPageContent /></Suspense>;
}
