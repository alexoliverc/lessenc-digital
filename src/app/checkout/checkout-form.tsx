"use client";

import { useActionState } from "react";

import { Stack } from "@/components/layout/layout";
import { Button, LinkAction } from "@/components/ui/button";
import { Alert, StatePanel } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";

import { createCheckoutOrderAction } from "./actions";
import { initialCheckoutActionState, type CheckoutActionState } from "./checkout-state";
import styles from "./page.module.css";

type CheckoutFormProps = Readonly<{
  submissionToken: string;
  product: Readonly<{
    name: string;
    description: string | null;
  }>;
  offer: Readonly<{
    formattedPrice: string;
    purchaseLabel: string;
  }>;
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
    case "PRICE_CHANGED":
      return null;

    case "FAILED":
      return (
        <Alert tone="danger" heading="Não foi possível concluir">
          <p>{state.message}</p>
        </Alert>
      );
  }
}

export function CheckoutForm({ submissionToken, product, offer }: CheckoutFormProps) {
  const [state, formAction, isPending] = useActionState(
    createCheckoutOrderAction,
    initialCheckoutActionState,
  );

  if (state.state === "UNAVAILABLE") {
    return (
      <StatePanel
        kind="empty"
        title="Oferta indisponível"
        description={state.message}
        className={styles.statePanel}
      >
        <LinkAction href="/cronograma-capilar-inteligente" variant="outline">
          Voltar ao produto
        </LinkAction>
      </StatePanel>
    );
  }

  if (state.state === "PRICE_CHANGED") {
    return (
      <StatePanel
        kind="empty"
        title="Preço atualizado"
        description={state.message}
        className={styles.statePanel}
      >
        <LinkAction href="/checkout" variant="outline">
          Revisar preço atualizado
        </LinkAction>
      </StatePanel>
    );
  }

  const completed = state.state === "CREATED" || state.state === "EXISTING";

  const emailErrorProps =
    state.state === "VALIDATION_ERROR"
      ? {
          error: state.emailError,
        }
      : {};

  return (
    <div className={styles.checkoutGrid}>
      <Surface elevation="raised" padding="spacious" className={styles.summary}>
        <Stack gap="large">
          <div>
            <p className={styles.eyebrow}>Resumo</p>

            <h2>{product.name}</h2>

            {product.description && <p className={styles.description}>{product.description}</p>}
          </div>

          <div className={styles.rule} aria-hidden="true" />

          <div>
            <p className={styles.price}>{offer.formattedPrice}</p>

            <p className={styles.purchaseLabel}>{offer.purchaseLabel}</p>
          </div>

          <ul className={styles.summaryList}>
            <li>Produto digital da L&apos;Essenc.</li>
            <li>O valor exibido é resolvido novamente no servidor.</li>
            <li>Esta fase cria um pedido pendente.</li>
            <li>Nenhum pagamento é processado nesta etapa.</li>
          </ul>
        </Stack>
      </Surface>

      <Surface padding="spacious" className={styles.formCard}>
        <Stack gap="large">
          <div>
            <p className={styles.eyebrow}>Dados do pedido</p>
            <h2>Para continuar</h2>
            <p className={styles.description}>
              Informe um e-mail válido. Você não precisa criar uma conta nesta etapa.
            </p>
          </div>

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
              Esta etapa cria apenas um pedido pendente. Nenhuma cobrança ou pagamento é realizado
              agora.
            </p>
          </form>
        </Stack>
      </Surface>
    </div>
  );
}
