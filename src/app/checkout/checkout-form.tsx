"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";

import { createCheckoutOrderAction } from "./actions";
import { initialCheckoutActionState, type CheckoutActionState } from "./checkout-state";
import styles from "./page.module.css";

type CheckoutFormProps = Readonly<{
  submissionToken: string;
}>;

function CheckoutFeedback({
  state,
}: Readonly<{
  state: CheckoutActionState;
}>) {
  switch (state.state) {
    case "IDLE":
      return null;

    case "VALIDATION_ERROR":
      return (
        <Alert tone="warning" heading="Revise o e-mail informado">
          <p>{state.message}</p>
        </Alert>
      );

    case "CREATED":
      return (
        <Alert tone="success" heading="Pedido criado">
          <p>{state.message}</p>
        </Alert>
      );

    case "EXISTING":
      return (
        <Alert tone="information" heading="Pedido já registrado">
          <p>{state.message}</p>
        </Alert>
      );

    case "UNAVAILABLE":
      return (
        <Alert tone="warning" heading="Oferta indisponível">
          <p>{state.message}</p>
        </Alert>
      );

    case "FAILED":
      return (
        <Alert tone="danger" heading="Não foi possível concluir">
          <p>{state.message}</p>
        </Alert>
      );
  }
}

export function CheckoutForm({ submissionToken }: CheckoutFormProps) {
  const [state, formAction, isPending] = useActionState(
    createCheckoutOrderAction,
    initialCheckoutActionState,
  );

  const completed = state.state === "CREATED" || state.state === "EXISTING";

  const emailErrorProps =
    state.state === "VALIDATION_ERROR"
      ? {
          error: state.emailError,
        }
      : {};

  return (
    <form action={formAction} className={styles.form} noValidate>
      <input type="hidden" name="submissionToken" value={submissionToken} />

      <TextField
        {...emailErrorProps}
        id="checkout-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        label="Seu e-mail"
        helperText="Usaremos este e-mail para registrar o pedido."
        placeholder="voce@exemplo.com"
        required
        disabled={completed || isPending}
      />

      <CheckoutFeedback state={state} />

      <Button
        type="submit"
        className={styles.submit}
        loading={isPending}
        loadingLabel="Criando pedido…"
        disabled={completed}
      >
        {completed ? "Pedido registrado" : "Criar pedido"}
      </Button>

      <p className={styles.formNote}>
        Esta etapa cria apenas um pedido pendente. Nenhuma cobrança ou pagamento é realizado agora.
      </p>
    </form>
  );
}
