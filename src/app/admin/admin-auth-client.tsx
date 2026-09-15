"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

async function post(path: string, body: Record<string, unknown>) {
  return fetch(`/api/admin/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function LoginForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await post("/sign-in/email", {
      email: form.get("email"),
      password: form.get("password"),
    });
    if (!response.ok) {
      setMessage("Não foi possível autenticar. Verifique os dados e tente novamente.");
      return;
    }
    const result = (await response.json()) as { next?: string };
    router.replace(result.next === "TOTP_REQUIRED" ? "/admin/mfa" : "/admin/mfa/enroll");
  }
  return (
    <form className="admin-auth-form" onSubmit={submit}>
      <label>
        E-mail
        <input name="email" type="email" autoComplete="username" required maxLength={320} />
      </label>
      <label>
        Senha
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {message && <p role="alert">{message}</p>}
      <button type="submit">Entrar com segurança</button>
    </form>
  );
}

export function MfaForm() {
  const router = useRouter();
  const [backup, setBackup] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const code = form.get("code");
    const response = await post(
      backup ? "/two-factor/verify-backup-code" : "/two-factor/verify-totp",
      { code, trustDevice: false },
    );
    if (!response.ok) {
      setMessage("Código inválido ou expirado.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }
  return (
    <form className="admin-auth-form" onSubmit={submit}>
      <label>
        {backup ? "Código de recuperação" : "Código do autenticador"}
        <input
          name="code"
          inputMode={backup ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
        />
      </label>
      {message && <p role="alert">{message}</p>}
      <button type="submit">Verificar</button>
      <button className="admin-link-button" type="button" onClick={() => setBackup(!backup)}>
        {backup ? "Usar aplicativo autenticador" : "Usar código de recuperação"}
      </button>
    </form>
  );
}

export function EnrollmentForm() {
  const router = useRouter();
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function enable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    const response = await post("/two-factor/enable", { password, method: "totp" });
    if (!response.ok) {
      setMessage("Não foi possível iniciar a configuração.");
      return;
    }
    const data = (await response.json()) as { totpURI?: string; backupCodes?: string[] };
    setUri(data.totpURI ?? "");
    setCodes(data.backupCodes ?? []);
  }
  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = new FormData(event.currentTarget).get("code");
    const response = await post("/two-factor/verify-totp", { code, trustDevice: false });
    if (!response.ok) {
      setMessage("Código inválido. Confira o autenticador.");
      return;
    }
    setCodes([]);
    setUri("");
    router.replace("/admin");
    router.refresh();
  }
  if (!uri)
    return (
      <form className="admin-auth-form" onSubmit={enable}>
        <label>
          Confirme sua senha
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Configurar autenticador</button>
      </form>
    );
  return (
    <div className="admin-enrollment">
      <p>
        Adicione esta configuração ao seu aplicativo TOTP. Ela será exibida apenas durante esta
        inscrição.
      </p>
      <code>{uri}</code>
      <h2>Códigos de recuperação</h2>
      <p>Guarde-os agora em local seguro. Cada código funciona uma vez.</p>
      <ul>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <form className="admin-auth-form" onSubmit={verify}>
        <label>
          Código do autenticador
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Concluir configuração</button>
      </form>
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="admin-link-button"
      type="button"
      onClick={async () => {
        await post("/sign-out", {});
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}

export function RegenerateBackupCodes() {
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    const response = await post("/two-factor/generate-backup-codes", { password });
    if (!response.ok) {
      setMessage("É necessário autenticar novamente antes desta operação.");
      return;
    }
    const data = (await response.json()) as { backupCodes?: string[] };
    setCodes(data.backupCodes ?? []);
  }
  return (
    <section className="admin-card">
      <h2>Novos códigos de recuperação</h2>
      <p>A geração invalida o conjunto anterior e exige sessão recente.</p>
      <form className="admin-auth-form" onSubmit={submit}>
        <label>
          Confirme sua senha
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Gerar novo conjunto</button>
      </form>
      {message && <p role="alert">{message}</p>}
      {codes.length > 0 && (
        <ul>
          {codes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
