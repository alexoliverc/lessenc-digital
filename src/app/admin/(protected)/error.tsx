"use client";
export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div className="admin-empty" role="alert">
      <strong>Não foi possível carregar esta área.</strong>
      <p>Tente novamente. Se o problema continuar, informe o suporte com o horário da falha.</p>
      <button className="admin-primary" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
